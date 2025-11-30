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
        })
        .catch((error) => {
          subscriber.next({
            data: {
              type: 'error',
              message: error instanceof Error ? error.message : String(error),
            },
          });
          subscriber.complete();
        });
    });
  }
}

