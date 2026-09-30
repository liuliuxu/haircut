import type { AdminApi } from './types'
import { httpApi, downloadExport, downloadCustomerTemplate, downloadArchive } from './http'

/** 唯一数据通道：本地 Node 服务 + SQLite */
export const api: AdminApi = httpApi

export { downloadExport, downloadCustomerTemplate, downloadArchive }

export const DATA_SOURCE_LABEL = '本地数据库'
