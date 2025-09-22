import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities';

@Entity('sys_collect', {
  comment: '收藏夹表',
})
export class CollectEntity extends BaseEntity {
  @Column({ type: 'text', name: 'space_id', nullable: true, comment: '空间ID' })
  spaceId!: string;

  @Column({ type: 'text', name: 'card_id', nullable: true, comment: '卡片ID' })
  cardId!: string;

  @Column({ type: 'text', name: 'directory_id', nullable: true, comment: '父目录ID' })
  directoryId!: string;

  @Column({ type: 'text', name: 'card_type', nullable: true, comment: '卡片类型' })
  cardType!: string;

  @Column({ type: 'text', name: 'sub_type', nullable: true, comment: '子类型' })
  subType!: string;

  @Column({ type: 'text', nullable: true, comment: '名称' })
  name!: string;

  @Column({ type: 'text', nullable: true, comment: 'URL地址' })
  url!: string;

  @Column({ type: 'integer', name: 'is_folder', default: 0, comment: '是否为文件夹：0-否，1-是' })
  isFolder!: number;

  @Column({ type: 'text', name: 'sort_order', default: '0', comment: '排序路径' })
  sortOrder!: string;
} 