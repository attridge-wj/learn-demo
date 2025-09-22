import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

// 文档页面内容实体（按页面存储）
@Entity('document_page_content')
export class DocumentPageContentEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'text', name: 'document_id', comment: '文档MD5值', nullable: true })
  documentId!: string

  @Column({ type: 'text', name: 'space_id', comment: '空间ID', nullable: true })
  spaceId!: string

  // 如果是本地文件的情况下，cardId为对null，主要针对临时的文件对话，即文件卡片没有入库
  @Column({ type: 'text', name: 'card_id', comment: '卡片ID', nullable: true })
  cardId!: string

  @Column({ type: 'int', name: 'is_local_file', comment: '是否本地文件' })
  isLocalFile!: number

  @Column({ type: 'text', name: 'file_name', comment: '文件名' })
  fileName!: string

  @Column({ type: 'text', name: 'file_type', comment: '文件类型' })
  fileType!: string

  @Column({ type: 'text', name: 'file_path', comment: '文件路径' })
  filePath!: string

  @Column({ type: 'text', name: 'origin_path', comment: '文件原始路径' })
  originPath!: string

  @Column({ type: 'int', name: 'page_number', comment: '页码（从1开始）' })
  pageNumber!: number

  @Column({ type: 'text', comment: '页面内容' })
  content!: string

  @Column({ type: 'text', name: 'content_segmented', comment: '页面内容分词', nullable: true })
  contentSegmented!: string

  @CreateDateColumn({ name: 'create_time', comment: '创建时间' })
  createTime!: Date

  @UpdateDateColumn({ name: 'update_time', comment: '更新时间' })
  updateTime!: Date
}