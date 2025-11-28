import {
  BadRequestException,
  Controller,
  MessageEvent,
  Query,
  Req,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { CompositionService } from './composition.service';
import { CompositionStreamEvent } from './services/composition-agent.service';

interface StreamComposeQuery {
  threadId?: string;
  conversationId?: string;
  userPrompt?: string;
}

@Controller('composition')
export class CompositionController {
  constructor(private readonly compositionService: CompositionService) {}

  @Sse('stream')
  streamCompose(@Req() req: Request, @Query() query: StreamComposeQuery): Observable<MessageEvent> {
    const user = (req as any)?.user;
    if (!user) {
      throw new UnauthorizedException('User is not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    const { threadId, userPrompt, conversationId } = query;
    
    // Extract account ID from header if provided
    const accountId = req.headers['x-account-id'] as string | undefined;
    
    if (!threadId) {
      throw new BadRequestException('threadId is required');
    }

    const normalizedUserPrompt = typeof userPrompt === 'string' ? userPrompt : '';

    return new Observable<MessageEvent>((subscriber) => {
      const abortController = new AbortController();
      const writer = (event: CompositionStreamEvent) => {
        subscriber.next({ data: event });
      };

      this.compositionService
        .composeDraftStreamWithAgent(
          userId.toString(),
          { threadId, userPrompt: normalizedUserPrompt, conversationId, accountId },
          writer,
          abortController.signal,
        )
        .then((result) => {
          subscriber.next({ data: { type: 'final', payload: result } });
          subscriber.complete();
        })
        .catch((error) => {
          subscriber.next({ data: { type: 'error', message: error instanceof Error ? error.message : String(error) } });
          subscriber.complete();
        });

      return () => {
        abortController.abort();
      };
    });
  }
}

