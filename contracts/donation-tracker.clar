;; Post-Conditions Best Practices Demo
;; This contract demonstrates common patterns and gotchas with post-conditions

;; Simple donation tracker with multiple interaction patterns
;; Each function demonstrates a different post-condition scenario

;; Storage
(define-map donations principal uint)
(define-data-var total-raised uint u0)

;; Errors
(define-constant ERR_ZERO_AMOUNT (err u100))
(define-constant ERR_ALREADY_DONATED (err u102))

;; Helper to get contract principal
(define-private (get-contract-principal)
  (unwrap-panic (as-contract? () tx-sender))
)

;; SCENARIO 1: Simple STX Transfer (most common)
;; Post-condition: STX transfer from caller to contract
;; Pattern: (stx-post-condition sender-principal FungibleConditionCode amount)
(define-public (donate (amount uint))
  (let
    ((contract-principal (get-contract-principal)))

    (asserts! (> amount u0) ERR_ZERO_AMOUNT)

    ;; Transfer STX from caller to contract
    (try! (stx-transfer? amount tx-sender contract-principal))

    ;; Track donation
    (map-set donations tx-sender
      (+ (default-to u0 (map-get? donations tx-sender)) amount))

    (var-set total-raised (+ (var-get total-raised) amount))
    (ok amount)
  )
)

;; SCENARIO 2: Multiple Transfers (one function, multiple asset movements)
;; Post-condition: Two separate STX transfers
;; Gotcha: Need post-conditions for BOTH transfers, not just the user's
(define-public (split-donation (amount uint) (recipient principal))
  (let
    ((half (/ amount u2))
     (contract-principal (get-contract-principal)))

    (asserts! (> amount u1) ERR_ZERO_AMOUNT)

    ;; Half to contract
    (try! (stx-transfer? half tx-sender contract-principal))

    ;; Half to recipient
    (try! (stx-transfer? half tx-sender recipient))

    ;; Track donation (just the half that went to contract)
    (map-set donations tx-sender
      (+ (default-to u0 (map-get? donations tx-sender)) half))

    (var-set total-raised (+ (var-get total-raised) half))
    (ok half)
  )
)

;; SCENARIO 3: No Post-Conditions Needed (read-only)
;; Read-only functions never need post-conditions
(define-read-only (get-contract-balance)
  ;; In a real contract, this would check the contract's STX balance
  ;; For demo purposes, just return total raised
  (ok (var-get total-raised))
)

;; SCENARIO 3: Conditional Transfer (may or may not transfer)
;; Post-condition gotcha: If using DENY mode, must account for conditional logic
;; Best practice: Use post-conditions even for conditional transfers
(define-public (donate-once (amount uint))
  (let
    ((contract-principal (get-contract-principal)))

    (asserts! (> amount u0) ERR_ZERO_AMOUNT)

    ;; Only allow first-time donors
    (asserts! (is-none (map-get? donations tx-sender)) ERR_ALREADY_DONATED)

    ;; Transfer happens conditionally
    (try! (stx-transfer? amount tx-sender contract-principal))

    (map-set donations tx-sender amount)
    (var-set total-raised (+ (var-get total-raised) amount))
    (ok amount)
  )
)

;; SCENARIO 4: Read-only function (no post-conditions needed)
;; Best practice: Read-only functions never need post-conditions
(define-read-only (get-donation (donor principal))
  (ok (default-to u0 (map-get? donations donor)))
)

(define-read-only (get-total-raised)
  (ok (var-get total-raised))
)
