// 创建卡片关联关系
export interface CreateCardRelationDto {
  parentId: string;
  subId: string;
  spaceId?: string;
}

// 批量创建卡片关联关系
export interface BatchCreateCardRelationDto {
  parentId: string;
  subIds: string[];
  spaceId?: string;
}

// 批量删除卡片关联关系
export interface BatchDeleteCardRelationDto {
  parentId: string;
  subIds: string[];
} 