"use client";

import type { ComponentProps, ReactElement } from "react";
import { Box, Divider, Link, Paper, Typography } from "@mui/material";
import type { Route } from "next";
import { fontFamilies } from "@/theme";

const listSx = { mt: 0, mb: 2, pl: 3, "& > li + li": { mt: 0.75 } } as const;

// Prose reads in the softer `prose` tone, so bold also lifts to primary to stay distinct.
const strongSx = { "& strong": { color: "text.primary" } } as const;

const liSx = { "& > p": { mb: 1 }, ...strongSx } as const;

export function DocsH1(props: ComponentProps<"h1">): ReactElement {
  return <Typography variant="docsH1" sx={{ mb: 2 }} {...props} />;
}

export function DocsH2(props: ComponentProps<"h2">): ReactElement {
  return <Typography variant="docsH2" sx={{ mt: 5, mb: 1.5 }} {...props} />;
}

export function DocsH3(props: ComponentProps<"h3">): ReactElement {
  return <Typography variant="docsH3" sx={{ mt: 3.5, mb: 1 }} {...props} />;
}

export function DocsH4(props: ComponentProps<"h4">): ReactElement {
  return <Typography variant="docsH4" sx={{ mt: 3, mb: 1 }} {...props} />;
}

export function DocsP(props: ComponentProps<"p">): ReactElement {
  return <Typography variant="docsBody" sx={{ mb: 2, ...strongSx }} {...props} />;
}

export function DocsLink(props: ComponentProps<"a">): ReactElement {
  const { href = "", children, ...rest } = props;
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
  return <Typography variant="docsBody" component="li" sx={liSx} {...props} />;
}

export function DocsCode(props: ComponentProps<"code">): ReactElement {
  return (
    <Box
      component="code"
      sx={(theme) => ({
        fontFamily: fontFamilies.mono,
        // Relative on purpose: inline code has to track whatever line it sits in.
        fontSize: "0.85em",
        paddingInline: 0.6,
        paddingBlock: 0.1,
        borderRadius: theme.radii.sm,
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
      sx={(theme) => ({
        margin: 0,
        marginBottom: 2,
        padding: 2,
        overflowX: "auto",
        ...theme.typography.docsBody,
        fontFamily: fontFamilies.mono,
        // Undo the inline-code chrome inside fenced blocks.
        "& code": {
          border: 0,
          padding: 0,
          borderRadius: 0,
          backgroundColor: "transparent",
          fontSize: "inherit",
        },
      })}
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
        borderLeft: `2px solid ${theme.palette.line.borderHi}`,
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
          ...theme.typography.docsBody,
          "& th": {
            color: theme.palette.text.primary,
            textAlign: "left",
            fontWeight: theme.typography.body1Strong.fontWeight,
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
