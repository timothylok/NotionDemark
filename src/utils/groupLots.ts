import { Lot } from '../types'

export function computeAvgCost(lots: Lot[]): number {
  let totalCost = 0
  let totalQty = 0

  for (const lot of lots) {
    totalCost += lot.buyPrice * lot.quantity + lot.transFee
    totalQty += lot.quantity
  }

  return totalQty === 0 ? 0 : totalCost / totalQty
}
