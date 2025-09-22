import { AppDataSource } from './connection'
import { v4 as uuidv4 } from 'uuid'
import { SpaceEntity } from '../ipc/space/entities/sys_space.entity'
import store from '../utils/store'

export async function initData() {
  try {
    const spaceRepository = AppDataSource.getRepository(SpaceEntity)

    // 检查是否存在空间数据
    const spaceCount = await spaceRepository.count()
    
    // 如果没有空间数据，创建默认空间
    if (spaceCount === 0) {
      const defaultSpace = new SpaceEntity()
      defaultSpace.id = 'rebirth-default-space';
      defaultSpace.spaceName = '默认空间'
      defaultSpace.description = '系统默认创建的空间'
      defaultSpace.type = '0'
      defaultSpace.enabled = 1
      defaultSpace.status = 1
      
      await spaceRepository.save(defaultSpace)
      // 存入electron-store
      store.set('spaceId', defaultSpace.id)
      store.set('spaceName', defaultSpace.spaceName)
      console.log('已创建默认空间')
    }
    console.log('数据初始化完成')
  } catch (error) {
    console.error('数据初始化失败:', error)
    throw error
  }
} 