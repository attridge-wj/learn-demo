import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

// 文件索引实体
@Entity('file_index')
export class FileIndexEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'text', name: 'file_name', comment: '文件名' })
  fileName!: string

  @Column({ type: 'text', name: 'file_name_segmented', comment: '文件名分词', nullable: true })
  fileNameSegmented?: string

  @Column({ type: 'text', name: 'file_path', comment: '文件原始路径' })
  filePath!: string

  @Column({ type: 'bigint', name: 'file_size', comment: '文件大小（字节）' })
  fileSize!: number

  @Column({ type: 'text', name: 'file_type', comment: '文件类型' })
  fileType!: string

  @Column({ type: 'datetime', name: 'create_time', comment: '文件创建时间' })
  createTime!: Date

  @Column({ type: 'datetime', name: 'update_time', comment: '文件更新时间' })
  updateTime!: Date

  @CreateDateColumn({ name: 'index_time', comment: '索引时间' })
  indexTime!: Date
}
