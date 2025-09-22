import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities';

//用户和空间关联表  用户N-N空间
@Entity('sys_space_user', {
  comment: '用户和空间关联表',
})
export class UserSpaceEntity extends BaseEntity {
  @PrimaryColumn({ type: 'integer', name: 'user_id', comment: '用户ID' })
  userId!: number;

  @PrimaryColumn({ type: 'text', name: 'space_id', comment: '空间ID' })
  spaceId!: string;
}
