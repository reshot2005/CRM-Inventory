# StockOS — Complete User Guide (Beginner KT)

**Audience:** New staff, supervisors, and anyone giving training (KT).  
**Goal:** After reading this, a beginner can use every live screen and understand how stock stays correct.

> **How to use this document**  
> 1. Read **Part A** once (big picture).  
> 2. Use **Part B** as a menu-by-menu reference during training.  
> 3. Use **Part C** as daily SOPs (copy for the shop floor).  
> 4. Check **Part D** for screens that are not ready yet.

**App URL (local):** usually `http://localhost:1234` or `http://localhost:3000`  
**Login:** use the email/password given by your admin.

---

## Part A — Big picture (read this first)

### What is StockOS?

StockOS is a **factory inventory system**. It tracks:

- What products you have (catalog / SKUs)
- How much stock you have at each location
- Buying (purchase orders + receive)
- Making (manufacturing + BOMs)
- Selling (sales orders + dispatch)
- Corrections (adjustments)
- Team access (roles)

### The #1 rule of stock

| Layer | Meaning | Who edits it |
|-------|---------|--------------|
| **Product / SKU** | Name, code, category, photo, minimum stock | Anyone allowed to manage catalog |
| **Quantity** | How many pieces/kg you physically have | Changes **only** when you Receive, Produce, Dispatch, Transfer, or Adjust |

**Never try to “fix quantity” by editing the product name page.**  
Quantity changes through real operations.

### How stock goes up and down

```text
BUY materials     → Purchase Order → RECEIVE STOCK     → Raw / Packaging qty ↑
MAKE finished     → Manufacturing Start                 → Materials qty ↓
                  → Manufacturing Complete              → Finished goods qty ↑
SELL / SHIP       → Sales Order → DISPATCH              → Finished goods qty ↓
MOVE warehouse    → Move Order → Complete transfer      → one location ↓, another ↑
COUNT mismatch    → Adjustment (manager)                → qty ↑ or ↓ with reason
```

### Categories (very important when adding items)

| Category | Meaning | Typical examples |
|----------|---------|------------------|
| **RAW MATERIAL** | Ingredients / inputs you buy and consume | Resin, yarn, chemicals |
| **FINISHED GOOD** | Ready-to-sell products | PP woven bag 50kg |
| **PACKAGING** | Packing materials | Boxes, rolls, sacks |
| **OTHER** | Anything else | Tools, misc |

Choosing the wrong category makes the item show on the wrong screen.

### Roles (what staff can see)

There are two related ideas:

1. **App login role** (Users & access): VIEWER / STAFF / MANAGER / ADMIN  
2. **Organization role** (Team & Roles): OWNER / ADMIN / MANAGER / STAFF  

For beginners, remember:

| Who | Typical access |
|-----|----------------|
| **Staff** | Inventory browse, receive, transfers, basic ops; cannot deactivate vendors/customers; adjustments wait for approval |
| **Manager** | Sales, production, BOMs, challans, reports extras |
| **Admin / Owner** | Locations, user approvals, team invites, audit log |

If a menu item is missing, ask your admin — it is usually a **role** restriction, not a bug.

---

## Part B — Every screen, every important button

### Global dashboard chrome (top + left)

Always visible after login:

| Control | What it does |
|---------|----------------|
| **Left sidebar menus** | Go to each module |
| **Collapse / expand** | Shrink sidebar to icons |
| **Mobile Menu** | Open sidebar on phone |
| **Breadcrumbs** | Shows where you are |
| **Search StockOS / ⌘K** | Quick jump: Add inventory, Create sales order, Add vendor |
| **Bell (notifications)** | Alerts (low stock, adjustments, etc.). Mark all read; open linked page |
| **Moon / Sun** | Dark / light theme |
| **Your name** | Sign out |

---

## 1. Overview

### 1.1 Dashboard — `/dashboard`

**Purpose:** Today’s snapshot of the factory.

| What you see / click | Meaning |
|----------------------|---------|
| Low-stock banner → **View products** | Jump to products needing restock |
| **Active SKUs** card | How many products are active |
| **Low stock** card | Items at or below minimum |
| **Open POs** card | Purchase orders still open |
| **Pending deliveries** card | Deliveries still pending |
| Revenue MTD | Sales money this month (if any) |
| **Recent stock movements** | Latest in/out history (read-only) |
| Products preview → **View all** / **Add product** | Go to catalog |
| **AI assistant** box | Type simple questions like “low stock” or “purchase orders” and **Send** |

**Beginner tip:** Start every morning on Dashboard.

---

## 2. Inventory

### 2.1 Products & SKUs — `/dashboard/products`

**Purpose:** Master list of **all** items (all categories).

| Button / control | How to use |
|------------------|------------|
| **Add Item** | Opens add wizard (create new SKU) |
| **Search** | Type name or product code |
| Tabs **All / Raw Material / Finished Good / Packaging** | Filter by category |
| Page numbers | Next/previous pages |
| **Edit** (pencil) | Change name, min stock, image |
| **Ledger** (book) | See stock in/out history for that item |
| **Delete** (trash) | Soft-deactivate (hides from active lists; does not erase history) |
| Confirm **Deactivate** / **Cancel** | Confirm or abort deactivation |

**What staff do here:** Register new products, fix names/mins/photos, check history.  
**What staff do NOT do here:** Change quantity by typing.

---

### 2.2 Finished goods — `/dashboard/finished-goods`

Same table as Products, but **only Finished Goods**.

Use this when you only want to see sellable / produced stock.

Same buttons: Add Item, Search, Edit, Ledger, Deactivate, pagination.

---

### 2.3 Raw materials — `/dashboard/raw-materials`

**Only Raw Material items.**

| Control | How to use |
|---------|------------|
| Restock alert cards | Shows items at/below min |
| **Quick PO** | Creates a **draft Purchase Order** for preferred vendor (qty ≈ shortage) |
| Search | Find material by name/code |
| **Deactivate** | Hide unused material |

**Important:** Prefer setting a **preferred vendor** on the item/vendor link, or Quick PO may be disabled.

**To increase raw qty:** Create PO → **Receive stock** (not Quick PO alone).

---

### 2.4 Packaging — `/dashboard/packaging`

Same as Raw materials, for packaging SKUs.

Extra: **Table / Cards** view toggle.

---

### 2.5 Add inventory item — `/dashboard/inventory/add`

Opened from **Add Item**.

#### Step 1 of 2 — Product details

| Field / button | Required? | How to use |
|----------------|-----------|------------|
| **Name** | Yes | Clear warehouse name, e.g. `PP Woven Bag 50kg` |
| **Product code** | Yes | Unique code, e.g. `FG-002` |
| **Check** | — | Verifies code is not already used |
| **Category** | Yes | RAW MATERIAL / FINISHED GOOD / PACKAGING / OTHER |
| **Brand** | No | Optional brand |
| **Packaging type** | No | BOX, BAGS, ROLL, etc. |
| **Packaging size** | No | e.g. `50kg` |
| **Minimum stock level** | Yes | Alert threshold (not the current qty) |
| **Product image** | No | Upload / Change / Clear (JPEG/PNG/WebP/GIF, max 5 MB) |
| **Next** | — | Validates fields and goes to Step 2 |
| **← Back to inventory** | — | Leave without saving |

#### Step 2 of 2 — Review + image confirm

| Control | How to use |
|---------|------------|
| Image again | Confirm or change photo |
| Review list | Check name/code/category/min/image |
| **Back** | Return to Step 1 |
| **Add to inventory** | Saves item; creates **0 qty** at every active location; uploads image if chosen |

After save you return to inventory. Qty stays **0** until you receive or produce.

---

### 2.6 Edit item — `/dashboard/inventory/[id]/edit`

| Control | How to use |
|---------|------------|
| **← Back** | Return without saving |
| **Name** | Rename product |
| **Minimum stock level** | Change alert threshold |
| **Product image** | Upload / change / clear |
| **Save** | Writes changes |

You cannot change product code/category here (by design). To “change category,” create a new item correctly and deactivate the old one if needed.

---

### 2.7 Adjustments — `/dashboard/adjustments`

**Purpose:** Officially correct stock when physical count ≠ system.

| Control | How to use |
|---------|------------|
| **New adjustment** | Opens form |
| **Item** | Which SKU |
| **Location** | Which warehouse/factory location |
| **Type** | **ADD** (increase), **REMOVE** (decrease), **CORRECT** (±) |
| **Quantity** | How much to move |
| **Reason** | DAMAGED, EXPIRED, COUNT_CORRECTION, THEFT, FOUND, etc. |
| **Notes** | Optional explanation |
| **Apply adjustment** | Manager/Admin/Owner — stock updates **now** |
| **Submit for approval** | Staff — creates PENDING; stock does **not** change yet |
| Table + pagination | History of adjustments |

**Training rule:** Use Adjustments for mistakes/damage/count — **not** for normal purchase receive or sales.

---

### 2.8 Batches & expiry — `/dashboard/batches`

**Status: NOT READY (placeholder).**  
Batch numbers are entered when **completing manufacturing**. Do not train staff on this menu yet.

---

## 3. Orders

### 3.1 Purchase orders — `/dashboard/purchase-orders`

**Purpose:** Plan and track buys from vendors.

| Control | How to use |
|---------|------------|
| **Create PO** | Open create form |
| Vendor | Who you buy from |
| Expected date / notes | Optional planning |
| Lines: Item, Qty, Price | What you are buying |
| **+ Add line** | More items on same PO |
| Remove line | Delete a line |
| **Create PO** | Saves as **DRAFT** |
| **Cancel** | Close without saving |
| Click PO number / expand | See lines |
| **Send** | DRAFT → SENT (ready to receive) |
| **Receive** (on SENT / PARTIAL) | Enter received qty + location → **Confirm receive** |
| Pagination | Browse older POs |

**Stock impact:** Creating/sending a PO does **not** increase stock.  
**Confirm receive** increases stock (`PURCHASE_RECEIVE`).

---

### 3.2 Receive stock — `/dashboard/receive`

**Purpose:** Dedicated screen for receiving open POs.

| Control | How to use |
|---------|------------|
| List of SENT / PARTIALLY_RECEIVED POs | Pick what arrived |
| Expand PO | Enter qty received per line + location |
| **Confirm receive** | Stock ↑ |
| **Cancel** | Abort |

**Daily SOP:** When a truck arrives, use this screen (or PO → Receive).

---

### 3.3 Sales orders — `/dashboard/sales`

**Who sees it:** Manager / Admin (usually).

| Control | How to use |
|---------|------------|
| **New Sale Order** | Create draft SO |
| Customer | Who is buying |
| Location | Warehouse shipping from |
| Lines: item, qty, price | What they ordered |
| **Add line** | More products |
| **Create Order** | Saves **DRAFT** |
| Status tabs | All / Draft / Confirmed / Dispatched / Delivered / Cancelled |
| Search | Find orders |
| Expand row | Lines + payments |
| **Confirm** | DRAFT → CONFIRMED |
| **Dispatch** | Deducts finished stock; ready to ship |
| **Deliver** | Mark delivered |
| **Cancel** | Cancel draft/confirmed (with confirm) |
| **Record Payment** | Amount, mode (Cash/UPI/NEFT…), reference, notes → **Save Payment** |

**Stock impact:** Only **Dispatch** reduces inventory. Confirm alone does not.

---

### 3.4 Move orders (transfers) — `/dashboard/move-orders`

**Purpose:** Move stock between locations (Factory ↔ Hub ↔ Warehouse).

| Control | How to use |
|---------|------------|
| Status cards | Pending / In Transit / Completed / Cancelled counts |
| **New Transfer** | From location, To location, notes, lines |
| **+ Add Line** | Items + qty to move |
| **Create Transfer** | Create transfer order |
| **Complete** / **Complete Transfer** | Finish move (stock leaves source, arrives destination) |
| **Cancel** | Cancel open transfer |
| Details drawer | Inspect lines |

---

### 3.5 Delivery challans — `/dashboard/challans`

**Who sees it:** Manager / Admin.

| Control | How to use |
|---------|------------|
| **New Challan** | Pick a **dispatched** sales order; fill addresses / vehicle |
| **Create Challan** | Save challan |
| Expand | See lines |
| **PDF** | Download challan PDF |
| **Deliver** | Mark challan delivered |
| Search / pagination | Find older challans |

---

## 4. Production

### 4.1 Manufacturing — `/dashboard/production`

**Who sees it:** Manager / Admin.

| Control | How to use |
|---------|------------|
| **Machines** | Drawer to add/manage machines (live here even if Machines menu is stub) |
| **Plan production** | Choose BOM, target qty, location, machine, deadline → **Plan production** |
| Status filters | All / Planned / In Progress / … |
| **List / Kanban** | Two views of orders |
| Click order | Opens detail drawer |
| **Start production** | Consumes raw/packaging from BOM (stock ↓ materials) |
| **Complete production** | Enter produced qty / quality / batch info; finished goods stock ↑ |
| Labour log | Optional labour entry on the order |
| Pagination | Older orders |

**Training sequence:** Plan → Start → Complete.

---

### 4.2 BOMs (Bill of Materials) — `/dashboard/boms`

**Purpose:** Recipe: which materials make one finished good.

| Control | How to use |
|---------|------------|
| **Create BOM** | Finished good + version + yield + material lines |
| **Add line** | Add raw/packaging qty per batch/yield |
| **Create BOM** | Save |
| **New version** | Clone to a new version (old can be deactivated) |
| **Deactivate** | Stop using this BOM |
| View drawer | Inspect lines |

Without a BOM, manufacturing cannot calculate material needs correctly.

---

### 4.3 Machines — `/dashboard/machines`

**Status: NOT READY (placeholder).**  
Use **Manufacturing → Machines** drawer instead.

### 4.4 Quality assurance — `/dashboard/qa`

**Status: NOT READY (placeholder).**

---

## 5. People

### 5.1 Labour — `/dashboard/labour`

**Status: NOT READY (placeholder).**  
Log labour from **Manufacturing order drawer** for now.

### 5.2 Vendors — `/dashboard/vendors`

| Control | How to use |
|---------|------------|
| **Add Vendor** | Company, contacts, GST, terms |
| **Create Vendor** / **Update** | Save |
| Search | Find vendor |
| **Edit** | Change details |
| **Deactivate** | Hide vendor (Manager+) |

Vendors are required for Purchase Orders.

### 5.3 Customers — `/dashboard/customers`

| Control | How to use |
|---------|------------|
| **Add Customer** | Type, company/name, phone, address, GSTIN, credit limit |
| **Create / Update Customer** | Save |
| **Activity log** | Notes about the customer → **Add Note** |
| **Edit** | Change details |
| **Deactivate** | Hide customer (Manager+) |

Customers are required for Sales Orders.

---

## 6. Finance

### 6.1 Invoices — `/dashboard/invoices`

**Status: NOT READY.**  
Use **Sales Orders + Record Payment** for now.

### 6.2 Reports — `/dashboard/reports`

| Tab | What it shows |
|-----|----------------|
| **Stock Valuation** | Stock value |
| **Sales Register** | Sales |
| **Purchase Register** | Purchases |
| **Stock Movement** | Movements / chart |
| **Low Stock** | Items below min |

Each tab has **Export CSV** when data exists.

---

## 7. Administration

### 7.1 Locations — `/dashboard/admin/locations`

**Who:** Admin.

| Control | How to use |
|---------|------------|
| **Add location** | Type: FACTORY / HUB / WAREHOUSE; name; code; address |
| **Create / Update** | Save |
| **Activate / Deactivate** | Enable/disable location |
| Search / pagination | Browse |

**Why it matters:** Stock quantity is stored **per location**. New items get 0 qty at every active location.

### 7.2 Users & access — `/dashboard/admin/users`

**Who:** Admin.

| Control | How to use |
|---------|------------|
| Pending cards **Approve (Staff)** | Activate new registration |
| **Reject** | Reject with reason |
| Role dropdown | ADMIN / MANAGER / STAFF / VIEWER |

New users often wait on **Pending approval** until an admin approves.

### 7.3 Delivery types — `/dashboard/delivery-types`

**Status: NOT READY.**

### 7.4 Team & Roles — `/dashboard/settings/team`

| Control | How to use |
|---------|------------|
| Members table | See who is in your organization |
| Role dropdown | Change ADMIN / MANAGER / STAFF (not OWNER) |
| **Remove** | Remove member (not OWNER) |
| Invite email + role → **Create invite** | Creates invite and **copies link** |
| **Resend** | Copy invite link again |
| **Revoke** | Cancel pending invite |

**Invite flow for new teammate:**

1. Admin creates invite  
2. Copy link → send on WhatsApp/email  
3. Teammate opens link → Sign in / Register with **same email**  
4. **Accept invite** → joins your org data  

### 7.5 Audit log — `/dashboard/settings/audit-log`

**Who:** Owner / Admin.

| Control | How to use |
|---------|------------|
| Filters (Action, Entity, User, Dates) | Narrow events |
| Click row | Expand old vs new values |
| Prev / Next | Paginate |

Use for “who changed what.”

### 7.6 Settings — `/dashboard/settings`

| Tab | Controls |
|-----|----------|
| **Company Profile** | Logo upload, company name, GSTIN, address, phone, timezone → **Save Company Profile** |
| **Personal Info** | Your full name → **Save Personal Info** |
| **GST Settings** | GSTIN → **Save GST Settings** |

---

## 8. Login & account screens

| Screen | Path | What to do |
|--------|------|------------|
| Login | `/auth/login` | Email + password → **Sign In** |
| Forgot password | `/auth/forgot-password` | Enter email → reset link |
| Register | `/auth/register` | Fill profile → wait for email verify + admin approval |
| Pending approval | `/auth/pending-approval` | Wait; admin must approve |
| Invite accept | `/invite/accept?token=…` | Sign in → **Accept invite** |

---

## Part C — Daily SOPs (print these)

### SOP 1 — New product setup

1. Products & SKUs → **Add Item**  
2. Fill name, unique code (**Check**), correct **category**, min stock, photo  
3. **Next** → **Add to inventory**  
4. Confirm it appears under the right menu (Raw / FG / Packaging)

### SOP 2 — Buying materials

1. Vendors: ensure vendor exists  
2. Purchase orders → **Create PO** → lines → **Create PO** → **Send**  
3. When goods arrive → **Receive stock** → enter qty + location → **Confirm receive**  
4. Check Raw materials / Packaging qty increased  

### SOP 3 — Making finished goods

1. BOMs: ensure recipe exists for the finished good  
2. Manufacturing → **Plan production**  
3. Open order → **Start production** (materials deduct)  
4. When done → **Complete production** (finished goods increase)  
5. Check Finished goods qty  

### SOP 4 — Selling / shipping

1. Customers: ensure customer exists  
2. Sales → **New Sale Order** → **Create Order** → **Confirm**  
3. **Dispatch** (stock deducts)  
4. Optional: Delivery challans → create challan → PDF  
5. Optional: **Record Payment**  
6. **Deliver** when customer received  

### SOP 5 — Transfer between locations

1. Move orders → **New Transfer**  
2. From / To + lines → **Create Transfer**  
3. **Complete Transfer** when physically moved  

### SOP 6 — Stock count mismatch

1. Physical count a SKU at a location  
2. Adjustments → **New adjustment**  
3. Choose ADD/REMOVE/CORRECT + reason  
4. Manager clicks **Apply adjustment**  
5. Verify qty on Products / Finished goods  

### SOP 7 — Low stock response

1. Dashboard / notifications / Raw materials restock cards  
2. Quick PO or full Purchase Order  
3. Receive when goods arrive  

---

## Part D — Not ready yet (tell trainees honestly)

| Menu | Status | What to do instead |
|------|--------|--------------------|
| Batches & expiry | Placeholder | Enter batch info on manufacturing complete |
| Machines (sidebar) | Placeholder | Use Manufacturing → Machines drawer |
| Quality assurance | Placeholder | — |
| Labour (sidebar) | Placeholder | Log labour on production drawer |
| Invoices | Placeholder | Sales + Record Payment |
| Delivery types | Placeholder | — |

---

## Part E — Troubleshooting for beginners

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| Qty still 0 after creating PO | PO not received | Use **Receive stock** / Confirm receive |
| Qty not reduced after sale | Only Confirmed, not Dispatched | Click **Dispatch** |
| Cannot see Sales / Production | Role is Staff/Viewer | Ask admin for Manager |
| Cannot deactivate vendor | Staff role | Ask Manager/Admin |
| Image upload fails | Wrong file type/size or storage policy | JPEG/PNG/WebP/GIF ≤ 5 MB; stay logged in |
| Pending approval forever | Admin not approved | Ask Admin → Users & access |
| Invite fails | Wrong email signed in | Sign out; use invited email |
| Menu missing after login | Role filter | Check Team / Users role |

---

## Part F — Trainer checklist (KT day)

- [ ] Show Dashboard KPIs and notifications  
- [ ] Add one demo item with photo (correct category)  
- [ ] Create vendor + PO + receive → prove qty ↑  
- [ ] Show Raw materials restock / Quick PO  
- [ ] Show BOM + Plan/Start/Complete production → FG ↑, materials ↓  
- [ ] Create sales order → Confirm → Dispatch → prove FG ↓  
- [ ] Do one adjustment with reason  
- [ ] Show reports Export CSV  
- [ ] Show Team invite link (admin)  
- [ ] Clearly list **not ready** menus so staff don’t get stuck  

---

## Part G — Glossary

| Term | Meaning |
|------|---------|
| SKU | Stock Keeping Unit — one product code |
| Location | Factory / Hub / Warehouse where qty lives |
| Min stock | Alert level, not current qty |
| PO | Purchase Order |
| SO | Sales Order |
| BOM | Bill of Materials (recipe) |
| Dispatch | Ship / issue stock against sales |
| Receive | Accept purchased goods into stock |
| Ledger | History of stock movements for one item |
| Soft deactivate | Hide from lists; keep history |
| Org | Your company workspace in StockOS |

---

## Remember (closing line for KT)

> **Register products once. Move stock only through Receive, Produce, Dispatch, Transfer, or Adjust. That is how StockOS keeps real warehouse data.**

---

*Document version: StockOS Week 4 product surface (live modules). Update this guide when deferred menus (Batches, QA, Invoices, etc.) go live.*
