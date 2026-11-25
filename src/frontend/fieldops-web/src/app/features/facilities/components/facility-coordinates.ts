import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';

const sixDecimals = /^-?\d+(?:\.\d{1,6})?$/;

export const latitudeValidators = [
  Validators.pattern(sixDecimals),
  Validators.min(-90),
  Validators.max(90)
];

export const longitudeValidators = [
  Validators.pattern(sixDecimals),
  Validators.min(-180),
  Validators.max(180)
];

export const coordinatesPairValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const latitude = String(
    control.get('latitude')?.value ?? ''
  ).trim();

  const longitude = String(
    control.get('longitude')?.value ?? ''
  ).trim();

  return (latitude === '') === (longitude === '')
    ? null
    : { coordinatesPair: true };
};

export function parseCoordinate(value: string): number | null {
  const normalized = value.trim();

  return normalized === '' ? null : Number(normalized);
}