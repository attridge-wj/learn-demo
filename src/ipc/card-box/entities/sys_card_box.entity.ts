import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities';

@Entity('sys_card_box', {
  comment: '卡片盒表',
})
export class CardBoxEntity extends BaseEntity {
  @Column({ type: 'text', nullable: true, comment: '卡片盒名称' })
  name!: string;

  @Column({ type: 'text', name: 'space_id', nullable: true, comment: '空间ID' })
  spaceId!: string;

  @Column({ type: 'text', name: 'share_mode', nullable: true, default: '', comment: '分享模式：0-私有，1-公开' })
  shareMode!: string;

  @Column({ type: 'text', nullable: true, comment: '描述' })
  description!: string;

  @Column({ type: 'text', nullable: true, comment: '密码' })
  password!: string;

  @Column({ type: 'text', nullable: true, comment: '封面' })
  cover!: string;

  @Column({ type: 'integer', name: 'add_location', nullable: true, comment: '添加位置：0-本地，1-云端' })
  addLocation!: number;

  @Column({ type: 'text', name: 'color', nullable: true, default: '', comment: '颜色' })
  color!: string;

  @Column({ type: 'text', name: 'type', nullable: true, default: '1', comment: '类型' })
  type!: string;
} 