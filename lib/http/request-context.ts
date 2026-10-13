export type RequestContext = {
  userId: string;
  ip: string;
  browserId: string | null;
  requestId: string;
  now: Date;
};
