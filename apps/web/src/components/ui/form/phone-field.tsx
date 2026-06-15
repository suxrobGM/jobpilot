"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import {
  Box,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

interface CountryEntry {
  code: CountryCode;
  name: string;
  callingCode: string;
}

const COUNTRIES: CountryEntry[] = getCountries()
  .map((code) => ({
    code,
    name: REGION_NAMES.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function detectCountry(value: string): CountryCode | null {
  if (!value) {
    return null;
  }
  return parsePhoneNumberFromString(value)?.country ?? null;
}

function nationalDigits(value: string, country: CountryCode): string {
  if (!value) {
    return "";
  }
  const digits = value.replace(/\D/g, "");
  const cc = getCountryCallingCode(country);
  return digits.startsWith(cc) ? digits.slice(cc.length) : digits;
}

function formatNational(digits: string, country: CountryCode): string {
  if (!digits) {
    return "";
  }
  return new AsYouType(country).input(digits);
}

export interface PhoneFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  defaultCountry?: CountryCode;
  label?: string;
  placeholder?: string;
  helperText?: ReactNode;
  error?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}

export function PhoneField(props: PhoneFieldProps): ReactElement {
  const {
    value,
    onChange,
    onBlur,
    defaultCountry = "US",
    label = "Phone",
    placeholder,
    helperText,
    error,
    fullWidth = true,
    disabled,
    required,
    name,
  } = props;

  const [selectedCountry, setSelectedCountry] = useState<CountryCode | null>(null);
  const detected = detectCountry(value);
  const country: CountryCode = selectedCountry ?? detected ?? defaultCountry;

  const digits = nationalDigits(value, country);
  const display = formatNational(digits, country);

  const emit = (nextDigits: string, nextCountry: CountryCode): void => {
    const onlyDigits = nextDigits.replace(/\D/g, "");
    if (!onlyDigits) {
      onChange("");
      return;
    }
    onChange(`+${getCountryCallingCode(nextCountry)}${onlyDigits}`);
  };

  const handleCountryChange = (e: SelectChangeEvent<CountryCode>): void => {
    const next = e.target.value as CountryCode;
    setSelectedCountry(next);
    emit(digits, next);
  };

  const handleNumberChange = (raw: string): void => {
    emit(raw, country);
  };

  return (
    <TextField
      name={name}
      fullWidth={fullWidth}
      label={label}
      placeholder={placeholder}
      value={display}
      onChange={(e) => handleNumberChange(e.target.value)}
      onBlur={onBlur}
      error={error}
      helperText={helperText}
      disabled={disabled}
      required={required}
      type="tel"
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start" sx={{ mr: 0.5 }}>
              <Select
                value={country}
                onChange={handleCountryChange}
                variant="standard"
                disableUnderline
                disabled={disabled}
                aria-label="Country code"
                renderValue={(cc) => (
                  <Typography component="span" variant="body2" sx={{ color: "text.secondary" }}>
                    +{getCountryCallingCode(cc as CountryCode)}
                  </Typography>
                )}
                MenuProps={{ slotProps: { paper: { sx: { maxHeight: 360 } } } }}
              >
                {COUNTRIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                      <Typography component="span" variant="body2">
                        {c.name}
                      </Typography>
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ ml: "auto", color: "text.secondary" }}
                      >
                        +{c.callingCode}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
