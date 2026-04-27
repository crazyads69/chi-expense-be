import { Injectable, BeforeApplicationShutdown } from '@nestjs/common';

@Injectable()
export class ShutdownService implements BeforeApplicationShutdown {
  private shuttingDown = false;

  beforeApplicationShutdown(_signal?: string) {
    this.shuttingDown = true;
  }

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }
}
