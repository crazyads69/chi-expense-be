import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import OpenAI from 'openai';
import { getOpenAIClient } from '../lib/openrouter';
import { MERCHANT_CATEGORY_MAP } from '../lib/merchant-table';
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from '../lib/prompts';

const MAX_MESSAGE_LENGTH = 500;
const MAX_MERCHANT_LENGTH = 50;
const AMOUNT_MULTIPLIER = 1000;
const LLM_TEMPERATURE = 0.1;
const LLM_TEXT_MAX_TOKENS = 200;
const LLM_IMAGE_MAX_TOKENS = 300;

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
    // Basic sanitization
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH) {
      return 0;
    }

    const patterns = [
      /(\d{1,3}(?:,\d{3})*(?:[.,]\d+)?)\s*(?:k|nghìn|ng)/i,
      /(\d+(?:[.,]\d+)?)\s*(?:k|nghìn)/i,
      /(\d{1,3}(?:,\d{3})*(?:[.,]\d+)?)/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        let amount = match[1].replace(/[.,]/g, '');
        const hasThousands = /k|nghìn|ng/i.test(match[0]);
        if (hasThousands) {
          amount = (parseFloat(amount) * AMOUNT_MULTIPLIER).toString();
        }
        return parseInt(amount, 10);
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
      .replace(/k|nghìn|ngày?|vnd|dong|đồng/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned.slice(0, MAX_MERCHANT_LENGTH) || 'Unknown';
  }

  private sanitizeUserMessage(message: string): string {
    // Strip characters that could be used for prompt injection:
    // - JSON/control characters: { } [ ] < > \x00-\x1F
    // - Backticks: ` (used to escape markdown/code blocks)
    // - Triple quotes: """ (Python-style string delimiters)
    // Note: We preserve Vietnamese diacritics and normal punctuation.
    return message
      .replace(/[{}[\]<>\x00-\x1F`]/g, '')
      .replace(/"""/g, '"')
      .trim();
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

    try {
      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: 'qwen/qwen3-8b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: USER_PROMPT_TEMPLATE(this.sanitizeUserMessage(message)),
          },
        ],
        temperature: LLM_TEMPERATURE,
        max_tokens: LLM_TEXT_MAX_TOKENS,
      });

      const content = response.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*?\}/);

      if (!jsonMatch) {
        throw new HttpException(
          'AI response did not contain valid expense data',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        amount: number;
        merchant?: string;
        category?: string;
        note?: string;
      };
      return {
        amount:
          typeof parsed.amount === 'number'
            ? Math.abs(parsed.amount)
            : Math.abs(this.parseAmount(message)),
        merchant: parsed.merchant || this.extractMerchant(message),
        category: parsed.category || 'Khác',
        note: parsed.note,
      };
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
    try {
      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the expense details from this receipt.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64,
                },
              },
            ],
          },
        ],
        temperature: LLM_TEMPERATURE,
        max_tokens: LLM_IMAGE_MAX_TOKENS,
      });

      const content = response.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*?\}/);

      if (!jsonMatch) {
        throw new HttpException(
          'AI response did not contain valid expense data from image',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        amount?: number;
        merchant?: string;
        category?: string;
        note?: string;
      };
      return {
        amount:
          typeof parsed.amount === 'number' ? Math.abs(parsed.amount) : 0,
        merchant: parsed.merchant || 'Unknown',
        category: parsed.category || 'Khác',
        note: parsed.note,
      };
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
          'AI image parsing is taking too long. Please try again.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      this.logger.error(
        'LLM image parsing failed',
        error instanceof Error ? error.stack : error,
      );
      throw new HttpException(
        'AI service temporarily unavailable. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
