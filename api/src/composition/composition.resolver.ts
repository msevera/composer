import { Resolver, Query, Args } from '@nestjs/graphql';
import { Controller, Get, Post, Request, Body } from "@nestjs/common";
import type { Request as ExpressRequest } from "express";

import {
  ConversationState,  
} from './dto/compose-draft-agent.dto';
import { CompositionService } from './composition.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Resolver()
export class CompositionResolver {
  constructor(
    private compositionService: CompositionService,
  ) {    
  }

  @Query(() => ConversationState)
  async getConversationState(
    @Args('conversationId') conversationId: string,    
  ): Promise<ConversationState> {
    return this.compositionService.getConversationState(conversationId);
  }
}

