# Browser Tips

## Read the page with `browser_snapshot`, act on the refs it returns

`browser_snapshot` returns the accessibility tree with a stable `ref` for each element. Read the page from the snapshot, then `browser_click` / `browser_type` / `browser_select_option` / `browser_file_upload` the refs directly.

A full-page snapshot on a job board is large (50k-120k tokens). **Always narrow** by passing a `ref` for the container you care about - the results list, the job header, the apply button, the application form - so you only pull that subtree. Never snapshot the whole page once it has loaded.

**Snapshot budget** (narrow further if you exceed it): posting body ~1-3k, application form (or the current step of a multi-page form) ~2-4k, results list a few k. Scoring needs ~15 lines - title, required skills, responsibilities, years; if a narrowed posting still overflows, snapshot a tighter child or `Read`/`Grep` a saved copy. **One snapshot per state change** - if you already hold a `ref`, act on it; don't re-snapshot to re-find or "double-check".

## Decision Tree

| Goal                                            | How                                                                                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extract job listings from a search results page | `browser_snapshot` narrowed to the results list; read `{ title, company, location, url, postedAt }` per row                                                      |
| Read a single job posting (digest for scoring)  | `browser_snapshot` narrowed to the posting body; build the digest JSON yourself                                                                                  |
| Inventory fields in an application form         | `browser_snapshot` narrowed to the form; each input/select/checkbox carries a `ref`                                                                              |
| Locate the Apply button                         | `browser_snapshot` narrowed to the header; grab the Apply/Easy Apply control's `ref`                                                                             |
| Check if logged in on a board                   | `browser_snapshot` narrowed to the header - a Sign in / Log in control (or a visible password field) means not logged in; an account/avatar menu means logged in |
| Confirm an application was submitted            | `browser_wait_for` the confirmation, then a narrowed `browser_snapshot` for the success or error text                                                            |
| Act on an element whose `ref` you already have  | use the ref directly - no new snapshot                                                                                                                           |

## Pagination & infinite scroll

The first snapshot is one viewport, never the full result set. Infinite-scroll boards (hiring.cafe, LinkedIn, Indeed) lazy-load on scroll and usually have **no "Load more" button** - its absence isn't exhaustion.
Scroll the results container to the bottom (`browser_evaluate` `() => document.scrollingElement.scrollTo(0, document.scrollingElement.scrollHeight)`, or target the list `ref`; else `browser_press_key` `End`), `browser_wait_for` new rows, re-snapshot.
Paged boards: click next-page, wait, re-snapshot. Track rows by URL/key. Board is exhausted only after **2 consecutive** attempts add no new rows; a repeated batch means the scroll didn't take - retry the correct container.

## Best Practices

1. **Close popups and modals** before interacting (cookie banners, notification prompts).
2. **`browser_wait_for`** after navigation and form submissions; refs from a stale snapshot may no longer resolve - re-snapshot the container after the page changes.
3. **Narrow, don't re-snapshot the whole page.** If a narrowed snapshot still overflows, narrow the `ref` further, or `Read`/`Grep` saved API responses with `jq`. No inline Python/Node parsing.
4. **On unexpected state** - narrow snapshot, report what you see; don't guess.
5. **Verify file uploads** exist before referencing them.
6. **Never guess passwords** - read from `/api/credentials` (see setup.md).
