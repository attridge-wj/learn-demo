import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { AppDataSource } from '../../database/connection'
import { UserEntity } from './entities/user.entities'
import { UserDto } from './dto/index.dto'

export function setupUserIPC(): void {
  // 获取用户列表
  ipcMain.handle('user:getAll', async () => {
    try {
      console.log('getList-----')
      const userRepository = AppDataSource.getRepository(UserEntity)
      const users = await userRepository.find()
      console.log('查询到的用户:', users)
      return users
    } catch (error) {
      console.error('获取用户列表失败:', error)
      throw error
    }
  })

  // 创建用户
  ipcMain.handle('user:create', async (_event: IpcMainInvokeEvent, userData: UserDto) => {
    try {
      const userRepository = AppDataSource.getRepository(UserEntity)
      console.log('创建用户:', userData)
      const user = userRepository.create(userData)
      return await userRepository.save(user)
    } catch (error) {
      console.error('创建用户失败:', error)
      throw error
    }
  })

  // 更新用户
  ipcMain.handle('user:update', async (_event: IpcMainInvokeEvent, id: string, userData: UserDto) => {
    try {
      const userRepository = AppDataSource.getRepository(UserEntity)
      await userRepository.update(id, userData)
      return await userRepository.findOne({ where: { id } })
    } catch (error) {
      console.error('更新用户失败:', error)
      throw error
    }
  })

  // 删除用户
  ipcMain.handle('user:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const userRepository = AppDataSource.getRepository(UserEntity)
      return await userRepository.delete(id)
    } catch (error) {
      console.error('删除用户失败:', error)
      throw error
    }
  })
} 