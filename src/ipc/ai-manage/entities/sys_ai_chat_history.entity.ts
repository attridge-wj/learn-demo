import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities';

@Entity('sys_ai_chat_history', {
  comment: 'AI对话历史记录表',
})
export class AiChatHistoryEntity extends BaseEntity {
  @Column({ type: 'text', name: 'session_id', nullable: true, comment: '会话ID' })
  sessionId!: string;

  @Column({ type: 'text', name: 'role', nullable: true, comment: '角色：user-用户，assistant-助手' })
  role!: string;

  @Column({ type: 'text', nullable: true, comment: '消息内容' })
  content!: string;

  @Column({ type: 'text', name: 'model_name', nullable: true, comment: 'AI模型名称' })
  modelName!: string;

  @Column({ type: 'text', name: 'prompt_template_id', nullable: true, comment: '使用的提示词模板ID' })
  promptTemplateId!: string;

  @Column({ type: 'integer', name: 'tokens_used', nullable: true, default: 0, comment: '使用的token数量' })
  tokensUsed!: number;

  @Column({ type: 'text', name: 'space_id', nullable: true, comment: '空间ID' })
  spaceId!: string;

  @Column({ type: 'text', name: 'chat_type', nullable: true, comment: '对话类型：chat-对话，card-知识卡片问答，doc-文档问答' })
  chatType!: string;

  @Column({ type: 'text', nullable: true, comment: '上下文内容：知识库问答及文档问答时存储知识库及文档的文字内容' })
  context!: string;
} 