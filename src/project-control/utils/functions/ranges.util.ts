import { PCGS } from '@project-control/utils/constants';

/** Fetch a named range's value. */
export const getNamedValue = (name: string): string => PCGS.ss.getRangeByName(name).getValue();
