import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { AppDataSource } from '../../database/connection'
import { SpaceEntity } from './entities/sys_space.entity'
import { UserSpaceEntity } from './entities/sys_space_user.entity'
import { v4 as uuidv4 } from 'uuid'
// DTO 类型定义（可根据实际项目调整路径和内容）
import type { CreateSpaceDto, UpdateSpaceDto, QuerySpaceDto } from './dto/space.dto'
import store from '../../utils/store';
export function setupSpaceIPC(): void {
  // 获取用户关联的空间列表
  ipcMain.handle('space:getAll', async (_event: IpcMainInvokeEvent, userId: number) => {
    try {
      const spaceRepo = AppDataSource.getRepository(SpaceEntity)
      const spaces = await spaceRepo.find({ where: { delFlag: 0 } })
      return spaces
    } catch (error) {
      console.error('获取空间列表失败:', error)
      throw error
    }
  })

  // 分页查询空间
  ipcMain.handle('space:getPage', async (_event: IpcMainInvokeEvent, query: QuerySpaceDto & { page?: number, pageSize?: number }) => {
    try {
      const page = query.page || 1
      const pageSize = query.pageSize || 10
      const { spaceName, enabled, status } = query
      const spaceRepo = AppDataSource.getRepository(SpaceEntity)
      const qb = spaceRepo.createQueryBuilder('space')
        .where('space.delFlag = :delFlag', { delFlag: 0 })
      if (spaceName) qb.andWhere('space.spaceName LIKE :spaceName', { spaceName: `%${spaceName}%` })
      if (enabled !== undefined) qb.andWhere('space.enabled = :enabled', { enabled })
      if (status !== undefined) qb.andWhere('space.status = :status', { status })
      qb.orderBy('space.createTime', 'DESC')
      const [list, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount()
      return { list, total, page, pageSize }
    } catch (error) {
      console.error('分页查询空间失败:', error)
      throw error
    }
  })

  // 创建空间
  ipcMain.handle('space:create', async (_event: IpcMainInvokeEvent, createSpaceDto: CreateSpaceDto) => {
    console.log('创建空间', createSpaceDto)
    try {
      const spaceRepo = AppDataSource.getRepository(SpaceEntity)
      const space = spaceRepo.create({
        id: uuidv4(),
        ...createSpaceDto,
      })
      const savedSpace = await spaceRepo.save(space)
      return savedSpace
    } catch (error) {
      console.error('创建空间失败:', error)
      throw error
    }
  })

  // 更新空间
  ipcMain.handle('space:update', async (_event: IpcMainInvokeEvent, id: string, updateSpaceDto: UpdateSpaceDto) => {
    try {
      const spaceRepo = AppDataSource.getRepository(SpaceEntity)
      const space = await spaceRepo.findOne({ where: { id } })
      if (!space) throw new Error('空间不存在')
      const updatedSpace = await spaceRepo.save({ ...space, ...updateSpaceDto })
      // 如果更新的空间是当前空间，则更新electron-store
      if (updatedSpace.id === store.get('spaceId')) {
        store.set('spaceName', updatedSpace.spaceName)
      }
      return updatedSpace
    } catch (error) {
      console.error('更新空间失败:', error)
      throw error
    }
  })

  // 删除空间（软删除）
  ipcMain.handle('space:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const spaceRepo = AppDataSource.getRepository(SpaceEntity)
      const space = await spaceRepo.findOne({ where: { id } })
      if (!space) throw new Error('空间不存在')
      await spaceRepo.update({ id }, { delFlag: 1 })
      return { success: true }
    } catch (error) {
      console.error('删除空间失败:', error)
      throw error
    }
  })

  // 查询单个空间
  ipcMain.handle('space:getOne', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const spaceRepo = AppDataSource.getRepository(SpaceEntity)
      const space = await spaceRepo.findOne({ where: { id } })
      if (!space) throw new Error('空间不存在')
      return space
    } catch (error) {
      console.error('查询空间失败:', error)
      throw error
    }
  })

  // 切换空间，不用操作数据库，存入electron-store即可
  ipcMain.handle('space:switch', async (_event: IpcMainInvokeEvent, params: { spaceId: string, spaceName: string }) => {
    try {
      store.set('spaceId', params.spaceId)
      store.set('spaceName', params.spaceName)
      return true
    } catch (error) {
      console.error('切换空间失败:', error)
      throw error
    }
  })

  // 获取当前空间
  ipcMain.handle('space:getSpaceInfo', async (_event: IpcMainInvokeEvent) => {
    const spaceId = store.get('spaceId')
    const spaceName = store.get('spaceName')
    return { spaceId, spaceName }
  })

  // 退出空间
  ipcMain.handle('space:quit', async (_event: IpcMainInvokeEvent, spaceId: string, userId: number) => {
    try {
      const spaceRepo = AppDataSource.getRepository(SpaceEntity)
      const userSpaceRepo = AppDataSource.getRepository(UserSpaceEntity)
      const space = await spaceRepo.findOne({ where: { id: spaceId } })
      if (!space) throw new Error('空间不存在')
      if ((space as any).createUserId === userId) throw new Error('空间创建者不能退出空间，如需退出请先转移空间所有权')
      await userSpaceRepo.delete({ spaceId, userId })
      return { success: true }
    } catch (error) {
      console.error('退出空间失败:', error)
      throw error
    }
  })

  // 转移空间所有权
  ipcMain.handle('space:transfer', async (_event: IpcMainInvokeEvent, spaceId: string, targetUserId: number, currentUserId: number) => {
    try {
      return await AppDataSource.transaction(async manager => {
        const spaceRepo = manager.getRepository(SpaceEntity)
        const userSpaceRepo = manager.getRepository(UserSpaceEntity)
        const space = await spaceRepo.findOne({ where: { id: spaceId } })
        if (!space) throw new Error('空间不存在')
        if ((space as any).createUserId !== currentUserId) throw new Error('只有空间创建者才能转移空间所有权')
        const userSpace = await userSpaceRepo.findOne({ where: { spaceId, userId: targetUserId } })
        if (!userSpace) {
          await userSpaceRepo.save({ spaceId, userId: targetUserId })
        }
        await spaceRepo.update(spaceId, { updateTime: new Date().toISOString() })
        return { success: true }
      })
    } catch (error) {
      console.error('转移空间所有权失败:', error)
      throw error
    }
  })
}
