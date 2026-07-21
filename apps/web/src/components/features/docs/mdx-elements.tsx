"use client";

import type { ComponentProps, ReactElement } from "react";
import { Box, Divider, Link, Paper, Typography } from "@mui/material";
import type { Route } from "next";
import { fontFamilies } from "@/theme";

// Docs body copy runs larger than the app chrome (theme body1 is dashboard-tuned).
const bodyText = { fontSize: "0.9375rem", lineHeight: 1.7 } as const;

const listSx = { mt: 0, mb: 2, pl: 3, "& > li + li": { mt: 0.75 } } as const;

export function DocsH1(props: ComponentProps<"h1">): ReactElement {
  return <Typography variant="h1" component="h1" sx={{ mb: 2, fontSize: "2rem" }} {...props} />;
}

export function DocsH2(props: ComponentProps<"h2">): ReactElement {
  return (
    <Typography
      variant="h2"
      component="h2"
      sx={{ mt: 6, mb: 1.5, fontSize: "1.5rem" }}
      {...props}
    />
  );
}

export function DocsH3(props: ComponentProps<"h3">): ReactElement {
  return <Typography variant="h3" component="h3" sx={{ mt: 4, mb: 1 }} {...props} />;
}

export function DocsH4(props: ComponentProps<"h4">): ReactElement {
  return <Typography variant="h4" component="h4" sx={{ mt: 3, mb: 1 }} {...props} />;
}

export function DocsP(props: ComponentProps<"p">): ReactElement {
  return <Typography component="p" sx={{ mb: 2, ...bodyText }} {...props} />;
}

export function DocsLink(props: ComponentProps<"a">): ReactElement {
  const { href = "", children, ...rest } = props;
  if (href.startsWith("http")) {
    // Explicit anchor: next/link is the theme default for MuiLink, and it should not render an
    // off-site URL.
    return (
      <Link component="a" href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <Link href={href as Route} {...rest}>
      {children}
    </Link>
  );
}

export function DocsUl(props: ComponentProps<"ul">): ReactElement {
  return <Box component="ul" sx={listSx} {...props} />;
}

export function DocsOl(props: ComponentProps<"ol">): ReactElement {
  return <Box component="ol" sx={listSx} {...props} />;
}

export function DocsLi(props: ComponentProps<"li">): ReactElement {
  return <Box component="li" sx={{ ...bodyText, "& > p": { mb: 1 } }} {...props} />;
}

export function DocsCode(props: ComponentProps<"code">): ReactElement {
  return (
    <Box
      component="code"
      sx={(theme) => ({
        fontFamily: fontFamilies.mono,
        fontSize: "0.85em",
        paddingInline: 0.6,
        paddingBlock: 0.1,
        borderRadius: `${theme.radii.sm}px`,
        border: `1px solid ${theme.palette.line.divider}`,
        backgroundColor: theme.palette.surfaces.elevated,
      })}
      {...props}
    />
  );
}

export function DocsPre(props: ComponentProps<"pre">): ReactElement {
  return (
    <Paper
      component="pre"
      variant="panel"
      sx={{
        margin: 0,
        marginBottom: 2,
        padding: 2,
        overflowX: "auto",
        fontFamily: fontFamilies.mono,
        fontSize: "0.8125rem",
        lineHeight: 1.6,
        // Undo the inline-code chrome inside fenced blocks.
        "& code": {
          border: 0,
          padding: 0,
          borderRadius: "0px",
          backgroundColor: "transparent",
          fontSize: "inherit",
        },
      }}
      {...props}
    />
  );
}

export function DocsBlockquote(props: ComponentProps<"blockquote">): ReactElement {
  return (
    <Box
      component="blockquote"
      sx={(theme) => ({
        margin: 0,
        marginBottom: 2,
        paddingLeft: 2,
        borderLeft: `3px solid ${theme.palette.accent.primary}`,
        color: "text.secondary",
        "& p": { mb: 1 },
      })}
      {...props}
    />
  );
}

export function DocsTable(props: ComponentProps<"table">): ReactElement {
  return (
    <Box sx={{ overflowX: "auto", mb: 2 }}>
      <Box
        component="table"
        sx={(theme) => ({
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.875rem",
          lineHeight: 1.6,
          "& th": {
            textAlign: "left",
            fontWeight: 600,
            padding: theme.spacing(1, 1.5),
            borderBottom: `1px solid ${theme.palette.line.border}`,
            whiteSpace: "nowrap",
          },
          "& td": {
            padding: theme.spacing(1, 1.5),
            borderBottom: `1px solid ${theme.palette.line.divider}`,
            verticalAlign: "top",
          },
        })}
        {...props}
      />
    </Box>
  );
}

export function DocsHr(): ReactElement {
  return <Divider sx={{ my: 4 }} />;
}
