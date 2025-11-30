import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Controller, Get, Post, Request, Body } from "@nestjs/common";
import type { Request as ExpressRequest } from "express";

import {
  ConversationState,  
} from './dto/compose-draft-agent.dto';
import { CompositionService } from './composition.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { SegmentService } from '../segment/segment.service';
import { UserService } from '../user/user.service';

@Resolver()
export class CompositionResolver {
  constructor(
    private compositionService: CompositionService,
    private segmentService: SegmentService,
    private userService: UserService,
  ) {    
  }

  @Query(() => ConversationState)
  async getConversationState(
    @Args('conversationId') conversationId: string,    
  ): Promise<ConversationState> {
    return this.compositionService.getConversationState(conversationId);
  }

  @Mutation(() => Boolean)
  async copyDraft(
    @Context() context: any,
    @Args('threadId', { nullable: true }) threadId?: string,
    @Args('conversationId', { nullable: true }) conversationId?: string,
  ): Promise<boolean> {
    const betterAuthUser = context.req.user;
    if (!betterAuthUser?.email) {
      throw new Error('Unauthorized');
    }

    // Find or get user ID
    let userDoc = await this.userService.findByEmail(betterAuthUser.email);
    if (!userDoc) {
      userDoc = await this.userService.create(betterAuthUser.email, betterAuthUser.name);
    }

    const userId = userDoc._id.toString();

    // Track Copy event in Segment
    this.segmentService.track(userId, 'Draft Copied', {
      threadId: threadId || null,
      conversationId: conversationId || null,
      source: 'extension',
    });

    return true;
  }
}

