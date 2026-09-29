# Texas BBQ Operations & Prep Questionnaire

This document captures operational preferences, pitmaster shift schedules, menu cuts, and smoker constraints to fine-tune the prep target and forecasting algorithms for your Texas BBQ pit operations.

---

## 1. Menu Cuts & Meat Prep Targets

- [ ] **Rib Cut Type**: What specific rib cuts are served on the menu?
  - [ ] Pork Spare Ribs (Standard Texas Cut)
  - --- we have full rack pork spare ribs and half rack pork spare ribs or the single bone ribs
  - [ ] Beef Dino Ribs (Plate Ribs) --- we have dino beef rib as well
  - *Current Algorithm Baseline*: 20% revenue allocation (~32 racks on a $4.8k peak Saturday).

- [ ] **Meat Sales Mix Distribution**: Does your sales volume roughly match these estimates, or should we adjust the ratios?
  - Brisket: `35%` of revenue
  - Pork Shoulder / Pulled Pork: `25%` of revenue
  - Pork Ribs: `20%` of revenue
  - Sausage Links: `20%` of revenue

---

## 2. Pitmaster & Prep Cook Shift Schedules

- [x] **Fixed 3-Person Team** (No dynamic staff adjustments needed; team is static):
  - **Pit Worker #1 (Early Morning / Smoke Watch)**: Arrives ~2:00 AM – 3:00 AM (manages long overnight smoke, wraps briskets/pork, pulls hot meat for 11 AM lunch rush).
  - **Pit Worker #2 (Morning Trim & Fresh Prep)**: Arrives ~6:00 AM – 7:00 AM (fires Batch 2 ribs & sausage, fresh sides prep, trims tomorrow's meat).
  - **Owner / Pitmaster (Afternoon & Service)**: Arrives ~1:00 PM (manages lunch-to-dinner transition, service rush, 9 PM station breakdown/close, evening pit coals).

---

## 3. Smoker & Equipment Capacity Constraints

- [ ] **Maximum Pit Capacity**: How many total pounds of raw brisket, pork shoulder, and racks of ribs can your smokers handle in a single session?
  - Max Brisket Capacity: `___ lbs` we can fit 14 briskets in the big pit and 10 in the small pit
  - Max Pork Shoulder Capacity: `___ lbs`
  - Max Rib Capacity: `___ racks`

- [ ] **Smoke Time Lead Times**:
  - Brisket cook duration: `12 smoke hours (plus 12-hour rest)
  - Pork Shoulder cook duration: `8 hours`
  - Ribs cook duration: `4

---

## 4. Itemized POS Line-Item Ingestion

- [ ] **Clover Itemized Ingestion**: Currently, the forecast converts total daily POS revenue (`total_usd`) into meat weights using Texas BBQ yield formulas. Would you like us to pull individual itemized line items from Clover (e.g., exact count of 1/2 lb brisket portions vs. full racks of ribs sold)? --- yes

---

## 5. Composite Item Portion Weights (For Clover API Tracking)

To better track and predict inventory directly from Clover API sales data, please provide the exact weight (e.g., in ounces) of the primary meat(s) included in the following composite items:

- [ ] **Tacos & Quesadillas**: How many ounces of meat go into each?
  - Crispy Quesa Taco Brisket: `_2__ oz`
  - Crispy Quesa Taco Pork / Turkey / Barbacoa: `_2__ oz`
  - Guisada Taco / Street Taco Barbacoa / Quesabirria taco: `__2_ oz`
  - Quesadilla (Brisket or Turkey): `_4__ oz`

- [ ] **Sandwiches**: How many ounces of meat are portioned per sandwich?
  - Bbq Sandwich (Brisket - Chopped Lean / Chopped Moist): `___ 7oz`
  - Pulled Pork / Turkey / Sausage Sandwich: `___8 oz`
  - 904 Sandwich / Two Step Sandwich: `___ oz` (please list all meats included)
  - "904 is a once a year promo but it was 1/2 lb and the 2 step is our more expensive sandwich, it has about 6 Oz brisket and half a link of sausage."

- [ ] **Specials & Loaded Items**: What is the meat portion for these?
  - Rosebud: `___ oz`brisket and its a ratio of 1:1 per brisket:cream cheese block of cream cheese (and please specify what meat is used) i probably go through 10 pounds of cream cheese for 40 rosebuds
  - Loaded Fries / BBQ Cheese Fries / Frito Pie: `___5 oz`frito pie is a promo came with 8 oz or 12 oz portion
  - San Antonio Salad w/ Meat: `___5 oz`
  - Burger (patty weight): `___ 9 oz`

- [ ] **Plates & Platters**: For combination plates, what is the standard meat portion?
  - 2 meat plate / BBQ plate / Guisada Plate: `___ 5/7/10 oz per meat, can you look up the meats from the menu?
  - Pitmaster Platter & 3 Sm Sides: `___5 oz brisket, 4 oz other meats besides 2 ribs total or breakdown per meat
  - Hill Country Trinity: `___ 5.5 oz brisket, link sausage, and 2 ribs total` or breakdown per meat

---

> **How to update**: You can edit this file directly or reply with your answers, and the system will update the prep algorithms accordingly!
