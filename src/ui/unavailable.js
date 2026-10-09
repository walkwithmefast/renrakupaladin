// The pickers' "what can't this character take?" checker, as a hook (see engine/purchasable.js). Memoized on the
// character, so a picker only re-checks its rows when the character actually changes.
import { useMemo } from 'preact/hooks';
import { useChar } from '../store.js';
import { unavailabilityChecker } from '../engine/purchasable.js';

/** @param {string} kind  picker item kind ('gear', 'cyberware', 'qualities', 'spells', ...)
 *  @param {string} [priceKind]  kind to price it as, for add-ons ('weapons' for an accessory, ...) */
export function useUnavailable(kind, priceKind) {
  const { ch, d } = useChar();
  return useMemo(() => (ch && d ? unavailabilityChecker(kind, ch, d, { priceKind }) : null), [kind, priceKind, ch, d]);
}
