import { Injectable } from '@nestjs/common';
import { GmailService } from './gmail.service';

interface GetCalendarEventsOptions {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

@Injectable()
export class CalendarService {
  constructor(private readonly gmailService: GmailService) {}

  async getCalendarEvents(userId: string, options: GetCalendarEventsOptions = {}) {
    const accessToken = await this.gmailService.getValidAccessToken(userId);

    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(options.maxResults ?? 10),
    });

    if (options.timeMin) params.append('timeMin', options.timeMin);
    if (options.timeMax) params.append('timeMax', options.timeMax);

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to fetch calendar events: ${message}`);
    }

    return response.json();
  }
}


