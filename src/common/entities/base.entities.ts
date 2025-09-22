import "reflect-metadata";
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeUpdate } from "typeorm";

@Entity()
export class BaseEntity {
  @PrimaryColumn("text")
  id!: string;

  @Column("integer", { name: 'del_flag', default: 0, comment: '删除标志' })
  public delFlag!: number;

  @Column("integer", { name: 'create_by', default: 0, comment: '创建者' })
  public createBy!: number;

  @CreateDateColumn({
    type: "text",
    name: 'create_time',
    comment: '创建时间',
    transformer: {
      to: (value: Date) => new Date().toISOString(), // 存储完整ISO格式
      from: (value: string) => {
        const date = new Date(value);
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      }
    }
  })
  public createTime!: string;

  @Column("integer", { name: 'update_by', default: 0, comment: '更新者' })
  public updateBy!: number;

  @UpdateDateColumn({
    type: "text",
    name: 'update_time',
    comment: '更新时间',
    transformer: {
      to: (value: Date) => new Date().toISOString(),
      from: (value: string) => {
        const date = new Date(value);
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      }
    }
  })
  public updateTime!: string;

  
  // 在实体类中添加钩子
  @BeforeUpdate()
  updateTimestamp() {
    this.updateTime = new Date().toISOString(); // 手动覆盖自动更新
  }
}

// 辅助函数：补零
function pad(num: number): string {
  return num.toString().padStart(2, '0');
}
