import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities';

@Entity('sys_ai_chat_session', {
  comment: 'AI对话会话表',
})
export class AiChatSessionEntity extends BaseEntity {
  @Column({ type: 'text', name: 'title', nullable: true, comment: '对话标题（第一个用户问题）' })
  title!: string;

  @Column({ type: 'text', name: 'model_name', nullable: true, comment: 'AI模型名称' })
  modelName!: string;

  @Column({ type: 'text', name: 'prompt_template_id', nullable: true, comment: '使用的提示词模板ID' })
  promptTemplateId!: string;

  @Column({ type: 'text', name: 'space_id', nullable: true, comment: '空间ID' })
  spaceId!: string;

  @Column({ type: 'integer', name: 'message_count', nullable: true, default: 0, comment: '对话消息数量' })
  messageCount!: number;

  @Column({ type: 'integer', name: 'total_tokens', nullable: true, default: 0, comment: '总token使用量' })
  totalTokens!: number;

  @Column({ type: 'text', name: 'last_message_time', nullable: true, comment: '最后消息时间' })
  lastMessageTime!: string;

  @Column({ type: 'text', name: 'chat_type', nullable: true, comment: '对话类型：chat-对话，card-知识卡片问答，doc-文档问答' })
  chatType!: string;
} 