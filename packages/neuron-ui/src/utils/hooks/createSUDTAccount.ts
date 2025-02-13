// TODO: update eslint to use 'import type' syntax
import { TFunction } from 'i18next'
import { useEffect, useCallback } from 'react'
import { AccountType, TokenInfo } from 'components/SUDTCreateDialog'
import { AppActions, StateAction } from 'states'
import {
  generateCreateSUDTAccountTransaction,
  openExternal,
  getSUDTTypeScriptHash,
  invokeShowErrorMessage,
} from 'services/remote'
import { getExplorerUrl } from 'utils'
import useGetCountDownAndFeeRateStats from './useGetCountDownAndFeeRateStats'
import { ErrorCode } from '../enums'
import { isSuccessResponse } from '../is'
import {
  MIN_CKB_REQUIRED_BY_CKB_SUDT,
  MIN_CKB_REQUIRED_BY_NORMAL_SUDT,
  SHANNON_CKB_RATIO,
  DEFAULT_SUDT_FIELDS,
  MEDIUM_FEE_RATE,
} from '../const'

interface IsInsufficientToCreateSudtAccountProps {
  walletId: string
  balance: bigint
  setInsufficient: React.Dispatch<Record<AccountType, boolean>>
}
export const useIsInsufficientToCreateSUDTAccount = ({
  walletId,
  balance,
  setInsufficient,
}: IsInsufficientToCreateSudtAccountProps) => {
  const { suggestFeeRate } = useGetCountDownAndFeeRateStats()

  return useEffect(() => {
    const createDummySUDTAccount = () => {
      if (balance <= BigInt(MIN_CKB_REQUIRED_BY_NORMAL_SUDT) * BigInt(SHANNON_CKB_RATIO)) {
        return true
      }
      const params: Controller.GenerateCreateSUDTAccountTransaction.Params = {
        walletID: walletId,
        tokenID: `0x${'0'.repeat(64)}`,
        tokenName: DEFAULT_SUDT_FIELDS.tokenName,
        accountName: DEFAULT_SUDT_FIELDS.accountName,
        symbol: DEFAULT_SUDT_FIELDS.symbol,
        decimal: '0',
        feeRate: `${suggestFeeRate}`,
      }
      return generateCreateSUDTAccountTransaction(params).catch(() => false)
    }
    const createDummyCKBAccount = () => {
      if (balance <= BigInt(MIN_CKB_REQUIRED_BY_CKB_SUDT) * BigInt(SHANNON_CKB_RATIO)) {
        return true
      }
      const params: Controller.GenerateCreateSUDTAccountTransaction.Params = {
        walletID: walletId,
        tokenID: DEFAULT_SUDT_FIELDS.CKBTokenId,
        tokenName: DEFAULT_SUDT_FIELDS.CKBTokenName,
        accountName: DEFAULT_SUDT_FIELDS.accountName,
        symbol: DEFAULT_SUDT_FIELDS.CKBSymbol,
        decimal: DEFAULT_SUDT_FIELDS.CKBDecimal,
        feeRate: `${suggestFeeRate}`,
      }
      return generateCreateSUDTAccountTransaction(params).catch(() => false)
    }

    Promise.all([createDummySUDTAccount(), createDummyCKBAccount()])
      .then(resList =>
        resList.map(res =>
          typeof res === 'boolean'
            ? res
            : [ErrorCode.CapacityNotEnough, ErrorCode.CapacityNotEnoughForChange].includes(res.status)
        )
      )
      .then(([insufficientToCreateSUDTAccount, insufficientToCreateCKBAccount]) => {
        setInsufficient({
          [AccountType.CKB]: insufficientToCreateCKBAccount,
          [AccountType.SUDT]: insufficientToCreateSUDTAccount,
        })
      })
  }, [walletId, balance, setInsufficient, suggestFeeRate])
}

export const useOnGenerateNewAccountTransaction = ({
  walletId,
  dispatch,
  onGenerated,
  t,
}: {
  walletId: string
  dispatch: React.Dispatch<StateAction>
  onGenerated: () => void
  t: TFunction
}) =>
  useCallback(
    ({ tokenId, tokenName, accountName, symbol, decimal }: TokenInfo) => {
      return generateCreateSUDTAccountTransaction({
        walletID: walletId,
        tokenID: tokenId,
        tokenName,
        accountName,
        symbol,
        decimal,
        feeRate: `${MEDIUM_FEE_RATE}`,
      })
        .then(res => {
          if (isSuccessResponse(res)) {
            return res.result
          }
          throw new Error(typeof res.message === 'string' ? res.message : res.message.content)
        })
        .then((res: Controller.GenerateCreateSUDTAccountTransaction.Response) => {
          dispatch({ type: AppActions.UpdateExperimentalParams, payload: res })
          dispatch({
            type: AppActions.RequestPassword,
            payload: { walletID: walletId as string, actionType: 'create-sudt-account' },
          })
          onGenerated()
          return true
        })
        .catch(err => {
          invokeShowErrorMessage({ title: t('messages.error'), content: err.message })
          return false
        })
    },
    [onGenerated, walletId, dispatch, t]
  )

export const useOpenSUDTTokenUrl = (tokenID: string, isMainnet?: boolean) =>
  useCallback(() => {
    if (tokenID) {
      getSUDTTypeScriptHash({ tokenID }).then(res => {
        if (isSuccessResponse(res) && res.result) {
          openExternal(`${getExplorerUrl(isMainnet)}/sudt/${res.result}`)
        }
      })
    }
  }, [isMainnet, tokenID])

export default { useIsInsufficientToCreateSUDTAccount, useOnGenerateNewAccountTransaction, useOpenSUDTTokenUrl }
