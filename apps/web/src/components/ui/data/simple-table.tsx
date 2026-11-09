import type { ReactElement, ReactNode } from "react";
import {
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { Route } from "next";
import { EmptyState } from "@/components/ui/feedback";

export interface SimpleColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  /** For action menus and dates that must not wrap. */
  nowrap?: boolean;
  /** Null or "" renders a muted dash. */
  render: (row: T) => ReactNode;
}

interface SimpleTableProps<T> {
  /** The first column names the row: it renders bold, and as the row's link when `rowHref` is set. */
  columns: SimpleColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle: string;
  rowHref?: (row: T) => Route;
}

/** A plain, server-renderable table for desktop-only admin views; user-facing lists use `ListRow`. */
// A transform makes the row the containing block for the name link's stretched ::after; other
// controls in the row sit above that overlay so they stay clickable.
const linkedRowSx = {
  transform: "scale(1)",
  "& button, & a:not([data-row-link])": { position: "relative", zIndex: 1 },
} as const;

export function SimpleTable<T>(props: SimpleTableProps<T>): ReactElement {
  const { columns, rows, rowKey, emptyTitle, rowHref } = props;

  if (rows.length === 0) {
    return <EmptyState variant="inline" title={emptyTitle} />;
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.key} align={column.align}>
                {column.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const href = rowHref?.(row);
            return (
              <TableRow key={rowKey(row)} hover sx={href ? linkedRowSx : undefined}>
                {columns.map((column, index) => (
                  <TableCell
                    key={column.key}
                    align={column.align}
                    sx={column.nowrap ? { whiteSpace: "nowrap" } : undefined}
                  >
                    {index === 0 ? (
                      <RowName href={href}>{column.render(row)}</RowName>
                    ) : (
                      <CellContent>{column.render(row)}</CellContent>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

interface CellContentProps {
  children: ReactNode;
}

function CellContent(props: CellContentProps): ReactNode {
  const { children } = props;
  const isBlank = children === null || children === undefined || children === "";
  if (isBlank) {
    return <Typography variant="captionMuted">-</Typography>;
  }
  return children;
}

interface RowNameProps {
  href: Route | undefined;
  children: ReactNode;
}

function RowName(props: RowNameProps): ReactElement {
  const { href, children } = props;
  if (!href) {
    return (
      <Typography variant="body1Strong" component="div">
        {children}
      </Typography>
    );
  }
  return (
    <Link
      href={href}
      data-row-link
      color="inherit"
      underline="none"
      variant="body1Strong"
      sx={{ "&::after": { content: '""', position: "absolute", inset: 0 } }}
    >
      {children}
    </Link>
  );
}
