# Orders Table: Sort, Filter, Paginate

**Goal:** The Orders desk keeps working at hundreds of Orders. Wide screens get a real table sortable by Placed and Total; phones keep the cards with a Sort dropdown. Both page through 50 Orders at a time and can narrow History Queues to a custom date range.

**Architecture:** One admin query, `orders/desk:getOrdersDeskPage`, reads a desk tab and its date window (at most `DESK_WINDOW` = 2,000 Orders), keeps search matches, sorts and returns one page with its total. The rules live in the pure module `convex/orders/deskPage.ts` (sort, page, date window) and `src/lib/admin/orderFilters.ts` (URL state, date window, header sorting). `getAllOrdersAdmin` stays for one release so a browser on the old build keeps working; remove it afterwards.

**Spec:** `CONTEXT.md` ("Working Queue", "History Queue"), and the decisions below. This supersedes plan 0009 D17 ("no pagination until the note is seen").

## Decisions (from the 2026-10-22 grilling)

1. Wide screens (`lg+`) get a table: Order # · Placed (date and age) · Customer · Status (pills and tags) · Items · Total · quick action. Phones keep the stacked cards.
2. Only Placed and Total sort, each both ways. Default: Placed, newest first. A new column starts descending; clicking the active one flips it. Phones sort from a dropdown.
3. Ranges: Today · 7d · 30d · All · Custom (From and To, whole local days, inclusive). "All" means all Orders, no 250 cut.
4. Working Queues ignore the range: the chips grey out with a hint. History Queues use it. A search looks through all dates.
5. 50 per page, Previous and Next, a "1–50 of 312" label, no page numbers. Any change but the page returns to page 1. A page past the end shows the last page.
6. Paging is offset-based over a sorted window, not Convex cursors: Total cannot be cursor-paged across mixed-status queues without a `total` index per queue. The query reads at most 2,000 Orders; above that the desk says "Showing the newest 2,000 orders in this range. Narrow the dates to see older ones." On All, the date window narrows the index read itself, so an old custom range still finds its Orders.
7. Queue, range, custom days, search, sort and page live in the URL; defaults are omitted.
8. The table stays live; rows keep the quick action, packing progress, Handed off tag and overdue warning.
9. Search results follow the chosen sort; exact number, email and tracking hits of any age are included.
10. Out of scope: CSV export, bulk actions, extra filters (carrier, guest vs account, amount).

## If the store outgrows it

Past a few thousand Orders in a History Queue's range, move to Convex cursor paging by `createdAt` and count with `@convex-dev/aggregate`. Total sorting would then need its own index per queue, or a narrower range. The screen and the URL contract do not change.

## Verification

- `convex/orders/deskPage.test.ts`: sort, page clamping, date window.
- `convex/orders/deskTable.test.ts`: a page of a sorted tab with its total, date windows on All and Done, search following the sort, Expired Checkouts skipped, signed-out empty page.
- `src/lib/admin/orderFilters.test.ts`: URL round trip, page reset, Working/History Queues, custom days across time zones, header sort toggling, pager bounds.
- Browser: table at desktop width, sort by Total both ways, Custom From date, a Working Queue greys the range, cards and Sort dropdown at 420px.
