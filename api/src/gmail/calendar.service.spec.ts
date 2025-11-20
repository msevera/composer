import { CalendarService } from './calendar.service';
import { GmailService } from './gmail.service';

describe('CalendarService', () => {
  const gmailService = {
    getValidAccessToken: jest.fn(),
  } as unknown as GmailService;

  let calendarService: CalendarService;

  beforeEach(() => {
    jest.resetAllMocks();
    calendarService = new CalendarService(gmailService);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    }) as any;
  });

  it('fetches events using resolved access token', async () => {
    (gmailService.getValidAccessToken as jest.Mock).mockResolvedValue('token');

    await calendarService.getCalendarEvents('user-1', { maxResults: 5 });

    expect(gmailService.getValidAccessToken).toHaveBeenCalledWith('user-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('maxResults=5'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }),
    );
  });
});


