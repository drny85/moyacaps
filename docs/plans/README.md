# Future Implementation Plans (`docs/plans/`)

This directory houses technical design documents, architectural blueprints, and feature specifications saved for future development cycles.

## Catalog of Plans

| Plan ID | Title | Status | Target Branch | Document |
| :--- | :--- | :--- | :--- | :--- |
| **0001** | **Undervisor & Side-Patch Customizer Studio ("Moya Studio")** | Ready for Implementation | `feat/customizer-studio` | [`0001-customizer-studio.md`](./0001-customizer-studio.md) |
| **0002** | **Mobile-First Storefront Redesign** | Ready for Implementation | 5 phase branches | [`0002-mobile-first-storefront-redesign.md`](./0002-mobile-first-storefront-redesign.md) |
| **0003** | **Try-On Redesign** | Implemented | `feat/try-on-redesign` | [`0003-try-on-redesign.md`](./0003-try-on-redesign.md) |
| **0004** | **Admin Catalog Foundation** | In progress | `feat/admin-catalog-foundation` | [`0004-admin-catalog-foundation.md`](./0004-admin-catalog-foundation.md) |
| **0005** | **Admin Products UI Redesign** | Design settled; waits on 0004 | `claude/admin-ui-redesign-25791f` | [`0005-admin-products-ui-redesign.md`](./0005-admin-products-ui-redesign.md) |
| **0007** | **Category Launch States** | Ready for Implementation | `feat/category-launch-states` | [`0007-category-launch-states.md`](./0007-category-launch-states.md) |
| **0010** | **Photo Autofill** | Implemented | `feat/photo-autofill` | [`0010-photo-autofill.md`](./0010-photo-autofill.md) |
| **0011** | **Product Reviews** | Implemented | `feat/product-reviews` | [`0011-product-reviews.md`](./0011-product-reviews.md) |

---

## Plan Structure Guidelines

Each plan in this directory should follow the standard structure:
1. **Overview & Business Value**: Problem statement, target user experience, and revenue/engagement impact.
2. **Architecture & Decisions**: Inventory handling, data models, state synchronization, and security considerations.
3. **Implementation Breakdown**: Concrete file-by-file changes across backend, store, frontend, and i18n layers.
4. **Verification & Testing Checklist**: Automated test commands, type checks, and manual QA walkthrough scenarios.
