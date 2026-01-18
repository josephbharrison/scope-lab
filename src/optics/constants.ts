/*
  Shared numerical defaults and coefficients for scope-lab optics engine.

  These are FIRST-ORDER assumptions for v1.
  They are not claims of physical optimality, only consistent baselines.
*/

/* -------------------------------------------------
   Optical surface transmission
-------------------------------------------------- */

export const DEFAULT_REFLECTIVITY_PER_MIRROR = 0.9;
export const DEFAULT_CORRECTOR_TRANSMISSION = 0.9;

/* -------------------------------------------------
   Geometry margins (mm)

   These account for:
   - mechanical clearance
   - cell thickness
   - focus travel
   - non-zero structure depth

   They are deliberately conservative and can be refined later.
-------------------------------------------------- */

export const DEFAULT_BACKFOCUS_MARGIN_MM = 50;
export const DEFAULT_TUBE_MARGIN_MM = 25;

/* -------------------------------------------------
   Newtonian-specific assumptions

   interceptFraction:
     Fraction of primary focal length from primary to secondary.
     Used as a first-order proxy when detailed mechanical layout
     (tube radius, focuser height) is not yet modeled.
-------------------------------------------------- */

export const NEWTONIAN_INTERCEPT_FRACTION = 0.25;

/* -------------------------------------------------
   Aberration proxy coefficients

   These scale dimensionless proxy scores so that
   different designs are comparable within a sweep.

   Lower proxyScore is better.
-------------------------------------------------- */

export const COMA_PROXY_COEFFICIENT = 1.0;
export const CASSEGRAIN_ABERRATION_PENALTY = 1.2;
export const SCT_ABERRATION_PENALTY = 1.4;
export const RC_ABERRATION_PENALTY = 0.8;

/* -------------------------------------------------
   Obstruction penalties

   Used to mildly penalize large central obstructions
   beyond pure area loss, reflecting contrast degradation.
-------------------------------------------------- */

export const OBSTRUCTION_CONTRAST_COEFFICIENT = 0.15;
