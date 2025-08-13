import { HttpStatus } from '@nestjs/common';
import { BaseApiException } from './base.exception';
import { ErrorCode } from '../types/api-response.types';

export class ChannelNotFoundException extends BaseApiException {
  constructor(channelId: string, details?: any) {
    super(
      ErrorCode.CHANNEL_NOT_FOUND,
      `Channel with ID ${channelId} not found`,
      HttpStatus.NOT_FOUND,
      { channelId, ...details },
    );
  }
}

export class ChannelAlreadyClosedException extends BaseApiException {
  constructor(channelId: string, details?: any) {
    super(
      ErrorCode.CHANNEL_ALREADY_CLOSED,
      `Channel ${channelId} is already closed`,
      HttpStatus.CONFLICT,
      { channelId, ...details },
    );
  }
}

export class InsufficientBalanceException extends BaseApiException {
  constructor(available: string, required: string, details?: any) {
    super(
      ErrorCode.INSUFFICIENT_BALANCE,
      `Insufficient balance. Available: ${available}, Required: ${required}`,
      HttpStatus.BAD_REQUEST,
      { available, required, ...details },
    );
  }
}

export class InvalidParticipantException extends BaseApiException {
  constructor(participant: string, details?: any) {
    super(
      ErrorCode.INVALID_PARTICIPANT,
      `Invalid participant address: ${participant}`,
      HttpStatus.BAD_REQUEST,
      { participant, ...details },
      'participant',
    );
  }
}

export class InvalidAmountException extends BaseApiException {
  constructor(amount: string, reason?: string, details?: any) {
    super(
      ErrorCode.INVALID_AMOUNT,
      `Invalid amount: ${amount}${reason ? `. ${reason}` : ''}`,
      HttpStatus.BAD_REQUEST,
      { amount, reason, ...details },
      'amount',
    );
  }
}

export class InvalidTokenException extends BaseApiException {
  constructor(token: string, chainId?: number, details?: any) {
    super(
      ErrorCode.INVALID_TOKEN,
      `Invalid token: ${token}${chainId ? ` on chain ${chainId}` : ''}`,
      HttpStatus.BAD_REQUEST,
      { token, chainId, ...details },
      'token',
    );
  }
}

export class UnsupportedChainException extends BaseApiException {
  constructor(chainId: number, details?: any) {
    super(
      ErrorCode.UNSUPPORTED_CHAIN,
      `Chain ID ${chainId} is not supported`,
      HttpStatus.BAD_REQUEST,
      { chainId, ...details },
      'chainId',
    );
  }
}
