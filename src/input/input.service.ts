import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import OpenAI from 'openai';
import * as Sentry from '@sentry/nestjs';
import { getOpenAIClient } from '../lib/openrouter';
import { MERCHANT_CATEGORY_MAP } from '../lib/merchant-table';
import {
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_IMAGE,
  USER_PROMPT_TEMPLATE,
  IMAGE_PROMPT_TEMPLATE,
} from '../lib/prompts';
import { getModelForTask, getFallbackModel } from '../lib/model-config';
import { resizeImageForLLM } from '../lib/image-resize';

const MAX_MESSAGE_LENGTH = 500;
const MAX_MERCHANT_LENGTH = 50;
const AMOUNT_MULTIPLIER = 1000;
const LLM_TEMPERATURE = 0.1;
const LLM_TEXT_MAX_TOKENS = 250;
const LLM_IMAGE_MAX_TOKENS = 350;

export interface ParsedExpense {
  amount: number;
  merchant: string;
  category: string;
  note?: string;
}

@Injectable()
export class InputService {
  private readonly logger = new Logger(InputService.name);

  private lookupMerchant(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    for (const [merchant, category] of MERCHANT_CATEGORY_MAP) {
      if (lowerMessage.includes(merchant.toLowerCase())) {
        return category;
      }
    }
    return null;
  }

  private parseAmount(message: string): number {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH) {
      return 0;
    }

    const patterns = [
      /(\d{1,3}(?:,\d{3})*(?:[.,]\d+)?)\s*(?:k|nghìn|ngàn)/i,
      /(\d+(?:[.,]\d+)?)\s*(?:k|nghìn)/i,
      /(\d{1,3}(?:,\d{3})*(?:[.,]\d+)?)/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const hasThousands = /k|nghìn|ngàn/i.test(match[0]);
        let amount: number;
        if (hasThousands) {
          amount = parseFloat(match[1].replace(/,/g, '')) * AMOUNT_MULTIPLIER;
        } else {
          amount = parseInt(match[1].replace(/[.,]/g, ''), 10);
        }
        return Math.floor(amount);
      }
    }
    return 0;
  }

  private extractMerchant(message: string): string {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH) {
      return 'Unknown';
    }
    const cleaned = message
      .replace(/\d{1,3}(?:,\d{3})*(?:[.,]\d+)?/g, '')
      .replace(/k|nghìn|ngàn|ngày?|vnd|dong|đồng/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned.slice(0, MAX_MERCHANT_LENGTH) || 'Unknown';
  }

  private sanitizeUserMessage(message: string): string {
    // Strip prompt injection characters while preserving Vietnamese text
    return message
      .replace(/[{}[\]<>\x00-\x1F`]/g, '')
      .replace(/"""/g, '"')
      .trim();
  }

  private extractJsonFromResponse(content: string): string | null {
    // Try fenced code block first
    const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fencedMatch) {
      const inner = fencedMatch[1].trim();
      if (inner.startsWith('{')) return inner;
    }

    // Try raw JSON object
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return null;
  }

  private normalizeExpense(parsed: {
    amount?: number;
    merchant?: string;
    category?: string;
    note?: string | null;
  }, fallback: { amount: number; merchant: string; category: string }): ParsedExpense {
    return {
      amount: typeof parsed.amount === 'number' ? Math.abs(parsed.amount) : fallback.amount,
      merchant: parsed.merchant || fallback.merchant,
      category: parsed.category || fallback.category,
      note: parsed.note || undefined,
    };
  }

  async parseText(userId: string, message: string): Promise<ParsedExpense> {
    const categoryFromMap = this.lookupMerchant(message);
    if (categoryFromMap) {
      return {
        amount: Math.abs(this.parseAmount(message)),
        merchant: this.extractMerchant(message),
        category: categoryFromMap,
      };
    }

    const model = getModelForTask('text', 'balanced');

    try {
      const openai = getOpenAIClient();
      const response = await Sentry.startSpan(
        { op: 'llm.parse', name: 'Parse Text Expense' },
        async () =>
          openai.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: USER_PROMPT_TEMPLATE(this.sanitizeUserMessage(message)),
              },
            ],
            temperature: LLM_TEMPERATURE,
            max_tokens: LLM_TEXT_MAX_TOKENS,
          }),
      );

      const content = response.choices[0]?.message?.content || '';
      const jsonStr = this.extractJsonFromResponse(content);

      if (!jsonStr) {
        throw new HttpException(
          'AI response did not contain valid expense data',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const parsed = JSON.parse(jsonStr) as {
        amount?: number;
        merchant?: string;
        category?: string;
        note?: string | null;
      };

      return this.normalizeExpense(parsed, {
        amount: Math.abs(this.parseAmount(message)),
        merchant: this.extractMerchant(message),
        category: 'Khác',
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (
        error instanceof SyntaxError ||
        (error instanceof Error && error.message.includes('JSON'))
      ) {
        throw new HttpException(
          'AI response could not be parsed',
          HttpStatus.BAD_GATEWAY,
        );
      }

      if (
        error instanceof OpenAI.APIError ||
        (error instanceof Error &&
          (error.message.toLowerCase().includes('timeout') ||
            error.message.toLowerCase().includes('network') ||
            error.message.toLowerCase().includes('connection')))
      ) {
        throw new HttpException(
          'AI parsing is taking too long. Please try again.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      this.logger.error(
        'LLM parsing failed',
        error instanceof Error ? error.stack : error,
      );
      throw new HttpException(
        'AI service temporarily unavailable. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async parseImage(
    userId: string,
    imageBase64: string,
  ): Promise<ParsedExpense> {
    let resizedImage: string;
    try {
      resizedImage = await resizeImageForLLM(imageBase64);
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : error },
        'Image resize failed',
      );
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Invalid image: could not process receipt image',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    let model = getModelForTask('image', 'balanced');
    let lastError: unknown;

    // Try primary model, then fallbacks on API/network errors
    while (model) {
      try {
        const openai = getOpenAIClient();
        const response = await Sentry.startSpan(
          { op: 'llm.parse', name: `Parse Image Expense (${model})` },
          async () =>
            openai.chat.completions.create({
              model,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT_IMAGE },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: IMAGE_PROMPT_TEMPLATE(),
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: resizedImage,
                      },
                    },
                  ],
                },
              ],
              temperature: LLM_TEMPERATURE,
              max_tokens: LLM_IMAGE_MAX_TOKENS,
            }),
        );

        const content = response.choices[0]?.message?.content || '';
        const jsonStr = this.extractJsonFromResponse(content);

        if (!jsonStr) {
          throw new HttpException(
            'AI response did not contain valid expense data from image',
            HttpStatus.BAD_GATEWAY,
          );
        }

        const parsed = JSON.parse(jsonStr) as {
          amount?: number;
          merchant?: string;
          category?: string;
          note?: string | null;
        };

        return this.normalizeExpense(parsed, {
          amount: 0,
          merchant: 'Unknown',
          category: 'Khác',
        });
      } catch (error) {
        lastError = error;

        // Non-retryable errors: throw immediately
        if (error instanceof HttpException) {
          throw error;
        }
        if (
          error instanceof SyntaxError ||
          (error instanceof Error && error.message.includes('JSON'))
        ) {
          throw new HttpException(
            'AI response could not be parsed',
            HttpStatus.BAD_GATEWAY,
          );
        }

        // Retryable errors: try fallback model
        const isRetryable =
          error instanceof OpenAI.APIError ||
          (error instanceof Error &&
            (error.message.toLowerCase().includes('timeout') ||
              error.message.toLowerCase().includes('network') ||
              error.message.toLowerCase().includes('connection') ||
              error.message.toLowerCase().includes('rate limit') ||
              error.message.toLowerCase().includes('service unavailable')));

        if (isRetryable) {
          const fallback = getFallbackModel(model, 'image');
          if (fallback) {
            this.logger.warn(
              `Image model ${model} failed (${error instanceof Error ? error.message : 'unknown'}), retrying with ${fallback}`,
            );
            model = fallback;
            continue;
          }
        }

        // No more fallbacks or non-retryable error
        break;
      }
    }

    // All models exhausted
    if (
      lastError instanceof OpenAI.APIError ||
      (lastError instanceof Error &&
        (lastError.message.toLowerCase().includes('timeout') ||
          lastError.message.toLowerCase().includes('network') ||
          lastError.message.toLowerCase().includes('connection')))
    ) {
      throw new HttpException(
        'AI image parsing is taking too long. Please try again.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.logger.error(
      'LLM image parsing failed (all models exhausted)',
      lastError instanceof Error ? lastError.stack : lastError,
    );
    throw new HttpException(
      'AI service temporarily unavailable. Please try again later.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
