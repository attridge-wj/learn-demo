import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm'

@Entity('card_derived_text')
export class CardDerivedTextEntity {
  @PrimaryColumn({ type: 'text', name: 'card_id' })
  cardId!: string

  @Column({ type: 'text', name: 'card_type', nullable: true })
  cardType!: string

  @Column({ type: 'text', name: 'name', nullable: true })
  name!: string

  @Column({ type: 'text', name: 'space_id', nullable: true })
  spaceId!: string

  @Column({ type: 'text', name: 'text', nullable: true })
  text!: string

  @Column({ type: 'text', name: 'origin_text', nullable: true })
  originText!: string

  @UpdateDateColumn({
    type: "text",
    name: 'update_time',
    comment: '更新时间',
    transformer: {
      to: (value: Date) => new Date().toISOString(),
      from: (value: string) => {
        const date = new Date(value);
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      }
    }
  })
  public updateTime!: string;
} 


// 辅助函数：补零
function pad(num: number): string {
  return num.toString().padStart(2, '0');
}