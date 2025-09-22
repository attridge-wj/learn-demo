import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities';

@Entity('sys_web_bookmark', {
  comment: '网页书签表',
})
export class WebBookmarkEntity extends BaseEntity {
  @Column({ type: 'text', nullable: true, comment: '书签名称' })
  name!: string;

  @Column({ type: 'text', nullable: true, comment: '书签URL' })
  url!: string;

  @Column({ type: 'text', nullable: true, comment: '描述' })
  description!: string;

  @Column({ type: 'text', name: 'parent_id', nullable: true, comment: '父级ID' })
  parentId!: string;

  @Column({ type: 'text', nullable: true, comment: '类别：directory-文件夹，bookmark-书签' })
  category!: string;

  @Column({ type: 'text', name: 'space_id', nullable: true, comment: '空间ID' })
  spaceId!: string;
}
