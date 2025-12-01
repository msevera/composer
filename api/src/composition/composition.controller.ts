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
import { UserService } from '../user/user.service';
import { SegmentService } from '../segment/segment.service';

interface StreamComposeQuery {
  threadId?: string;
  conversationId?: string;
  userPrompt?: string;
}

@Controller('composition')
export class CompositionController {
  constructor(
    private readonly compositionService: CompositionService,
    private readonly userService: UserService,
    private readonly segmentService: SegmentService,
  ) {}

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

    // Track streamCompose SSE event
    this.segmentService.track(userId.toString(), 'Stream Compose SSE', {
      threadId,
      conversationId,
      hasUserPrompt: !!normalizedUserPrompt,
      accountId,
    });

    return new Observable<MessageEvent>((subscriber) => {
      const abortController = new AbortController();
      let compositionPromise: Promise<void> | null = null;

      // Listen for client disconnection
      req.on('close', () => {
        abortController.abort();
      });

      req.on('aborted', () => {
        abortController.abort();
      });

      // Check usage limit before starting composition
      this.userService
        .checkDraftLimit(userId.toString())
        .then(async (limitCheck) => {
          const user = await this.userService.findById(userId.toString());
          if (limitCheck.hasReachedLimit) {
            subscriber.next({
              data: {
                type: 'error',
                key: 'draft-limit-reached',
                title: 'You\'ve reached the limit. Send this email to <a style="color: #00ff00;" href="mailto:michael.svr@gmail.com">michael.svr@gmail.com</a> to upgrade your account.',
                message: [
                  `Hey Mike,\n\n`,
                  `I've reached the limit of drafts I can create. Please upgrade my account.\n\n`,
                  `Best,`,
                  `${user?.name}`,
                ].join('\n'),
                
              },
            });
            subscriber.complete();
            return;
          }

          // Check if already aborted
          if (abortController.signal.aborted) {
            return;
          }

          const writer = (event: CompositionStreamEvent) => {
            // Don't send events if aborted
            if (abortController.signal.aborted) {
              return;
            }
            subscriber.next({ data: event });
          };

          compositionPromise = this.compositionService
            .composeDraftStreamWithAgent(
              userId.toString(),
              { threadId, userPrompt: normalizedUserPrompt, conversationId, accountId },
              writer,
              abortController.signal,
            )
            .then((result) => {
              if (!abortController.signal.aborted) {
                subscriber.next({ data: { type: 'final', payload: result } });
                subscriber.complete();
              }
            })
            .catch((error) => {
              // Don't send error if aborted (client disconnected)
              if (abortController.signal.aborted) {
                return;
              }
              // Check if it's an AbortError
              if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
                // Client disconnected, just complete silently
                subscriber.complete();
                return;
              }
              subscriber.next({ data: { type: 'error', message: error instanceof Error ? error.message : String(error) } });
              subscriber.complete();
            });
        })
        .catch((error) => {
          if (!abortController.signal.aborted) {
            subscriber.next({
              data: {
                type: 'error',
                message: error instanceof Error ? error.message : String(error),
              },
            });
            subscriber.complete();
          }
        });

      // Cleanup function - called when Observable is unsubscribed
      return () => {
        abortController.abort();
      };
    });
  }
}

