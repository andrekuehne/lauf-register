/** A Race's public registration page, relative to the site. */
export const publicRacePath = (token: string) => `/r/${token}`;

/** The Race's full public link, on the address the request came in on: what its QR code holds. */
export const publicRaceLink = (requestUrl: string, token: string) => `${new URL(requestUrl).origin}${publicRacePath(token)}`;
