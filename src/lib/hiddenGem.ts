/** A venue is a hidden gem when it is sunny now and not yet in the user's favourites.
 *  In v1 (local-only favourites) favCount is 0 or 1 per venue, so threshold=1 means
 *  "undiscovered by me and sunny right now." */
export const GEM_THRESHOLD = 1;

export function isHiddenGem(opts: { isSunnyNow: boolean; favCount: number }): boolean {
  return opts.isSunnyNow && opts.favCount < GEM_THRESHOLD;
}
