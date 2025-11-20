import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { CalendarService } from '../../gmail/calendar.service';

export const createGoogleCalendarTool = (calendarService: CalendarService) =>
  new DynamicStructuredTool({
    name: 'get_calendar_events',
    description: 'Retrieves upcoming Google Calendar events to help with scheduling context.',
    schema: z.object({
      timeMin: z.string().describe('RFC3339 timestamp for the start of the window').optional(),
      timeMax: z.string().describe('RFC3339 timestamp for the end of the window').optional(),
      maxResults: z.number().int().positive().max(20).optional(),
      userId: z.string().optional(),
    }),
    func: async ({ timeMin, timeMax, maxResults = 10, userId }) => {
      if (!userId) {
        throw new Error('userId is required to read calendar events');
      }

      const response = await calendarService.getCalendarEvents(userId, {
        timeMin,
        timeMax,
        maxResults,
      });

      const events = response.items ?? [];
      if (!events.length) {
        return 'No calendar events were found for the requested window.';
      }

      return events
        .map((event) => {
          const start = event.start?.dateTime || event.start?.date;
          const end = event.end?.dateTime || event.end?.date;
          const attendees = event.attendees?.map((a) => a.email).join(', ') || 'None';
          return `Event: ${event.summary || 'Untitled'}\nWhen: ${start} - ${end}\nLocation: ${
            event.location || 'N/A'
          }\nAttendees: ${attendees}`;
        })
        .join('\n\n---\n\n');
    },
  });


