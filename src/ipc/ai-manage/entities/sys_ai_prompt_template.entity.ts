import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities';

@Entity('sys_ai_prompt_template', {
  comment: 'AI提示词模板表',
})
export class AiPromptTemplateEntity extends BaseEntity {
  @Column({ type: 'text', nullable: true, comment: '模板名称' })
  name!: string;

  @Column({ type: 'text', nullable: true, comment: '模板描述' })
  description!: string;

  @Column({ type: 'text', nullable: true, comment: '提示词内容' })
  content!: string;

  @Column({ type: 'text', name: 'category', nullable: true, comment: '分类' })
  category!: string;

  @Column({ type: 'text', name: 'model_name', nullable: true, comment: '适用的AI模型名称' })
  modelName!: string;

  @Column({ type: 'text', name: 'space_id', nullable: true, comment: '空间ID' })
  spaceId!: string;

  @Column({ type: 'integer', name: 'is_default', nullable: true, default: 0, comment: '是否默认模板：0-否，1-是' })
  isDefault!: number;

  @Column({ type: 'integer', name: 'use_count', nullable: true, default: 0, comment: '使用次数' })
  useCount!: number;
} 