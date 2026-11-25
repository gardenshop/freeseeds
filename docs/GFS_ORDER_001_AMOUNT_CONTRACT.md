# GFS-ORDER-001 REV.2 Amount Contract

Owner financial invariant, not an implemented tariff engine. No pricing, Rs.125 fee, MO/history record or CAPI configuration changed in S0.

## Customer gross

Exact integer rupees only. COD gross = product/seed cost + fertilizer + existing province delivery + Rs.125 collection fee. Example0+250+250+125=625. Advance preserves existing pricing without COD fee. Preserve quotes, rates, order IDs and historical references.

Ordinary Admin, customer orders, WhatsApp, instructions and gross Excel export show gross, not postal commission. No extra commission charge/field and no double addition. The125 collection fee is not synonymous with75 postal commission.

## Postal output only

Let G be immutable gross, P be MO principal, C(P,tariffVersion) the applicable verified commission. Require **P+C(P)=G**. Owner example: G625/P550/C75; VPL block `550+75`, customer pays625, MO550. Advance RGL has **no amount block**.

Tariff source/version/effective date/boundaries/applicability are BLOCKED/unverified. One example does not justify flat75 commission or using125 as commission. Do not copy tariff/code from protected Label Printer. Use integer arithmetic and verify each boundary. If no legitimate principal reconciles, raise a private internal validation exception and block postal output without changing G. Multiple solutions require a verified postal selection rule, not silent arbitrary choice.

Commission is restricted to postal output and necessary private validation/accounting evidence, not ordinary Admin/reporting/customer fields. VPL postal label is the authorized principal+commission exception; an attached-message body must not restate it as another fee.

## Settlement compatibility

Normal MO handler `apps/admin/src/index.ts:795-845` requires `cod.quoted_total_pkr` and approves/stores gross; legacy collection/remittance748-786 also expects gross. Historical848-905/migration0048 protect original payable. None models principal/commission. A550 MO against gross625 currently fails. Label-only changes would produce unreconcilable accounting.

S6 requires audited prospective accounting distinguishing gross, actual remitted principal and commission evidence under verified tariff. Preserve history, HMAC/audit/Access/CSRF, actual received funds and immutable ledgers. Do not rewrite historical records, weaken guards or silently mark gross paid from unsupported principal. Late/historical differences require explicit reconciliation. Both MO ledgers currently0 rows; absence is not authorization to skip protections. CAPI remains untouched.

## Acceptance

AMT01 gross625/VPL550+75/MO550; AMT02 unchanged125/province totals/all advance methods; AMT03 integer boundaries; AMT04 no valid principal blocks without changing gross; AMT05 RGL no amount; AMT06 gross export/ordinary Admin/messages omit commission; AMT07 historical/MO controls; AMT08 atomic concurrent/duplicate-safe settlement. Revised postal cases NOT TESTED until implemented; existing regressions alone do not prove them.
