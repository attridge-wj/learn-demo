// 卡片关联关系相关类型定义
export interface CreateCardRelationDto {
  parentId: string;
  subId: string;
  spaceId?: string;
}

export interface BatchCreateCardRelationDto {
  parentId: string;
  subIds: string[];
  spaceId?: string;
}

export interface BatchDeleteCardRelationDto {
  parentId: string;
  subIds: string[];
}

// 卡片限制相关类型定义
export interface CardLimitData {
  currentCount: number;
  limit: number;
  message: string;
}

// 声明全局Window接口扩展
declare global {
  interface Window {
    cardApi: {
      // 原有卡片API
      queryAll: (query?: any) => Promise<any[]>;
      findByDate: (query: any) => Promise<any>;
      findAllDate: (query?: any) => Promise<any[]>;
      getOne: (id: string) => Promise<any>;
      batchCreate: (batch: any) => Promise<any[]>;
      batchDelete: (batch: any) => Promise<any>;
      findByIds: (ids: string[]) => Promise<any[]>;
      batchGet: (ids: string[]) => Promise<any[]>;
      batchUpdate: (batch: any) => Promise<any[]>;
      findPage: (query: any) => Promise<any>;
      statistics: (query: any) => Promise<any>;
      getAttachmentCount: (query: any) => Promise<any>;
      findRelateCards: (id: string) => Promise<any[]>;
      create: (cardData: any) => Promise<any>;
      update: (id: string, cardData: any) => Promise<any>;
      delete: (id: string, isPd: boolean) => Promise<boolean>;
      findRecyclePage: (query: any) => Promise<any>;
      restore: (ids: string[]) => Promise<any>;
      clearRecycle: () => Promise<boolean>;
      getCardSetTree: (boxId: string) => Promise<any>;
      getCardSetTreeByBoxIds: (boxIds: string[]) => Promise<any>;
      updateBoxId: (cardId: string, newBoxId: string, maxDepth?: number) => Promise<any>;
      findByYearMonth: (query: any) => Promise<any[]>;
      batchGetMindMapDetails: (ids: string[]) => Promise<any[]>;
      
      // 卡片关联关系相关API
      // 创建和批量创建
      createRelation: (relationData: CreateCardRelationDto) => Promise<any>;
      batchCreateRelations: (batchData: BatchCreateCardRelationDto) => Promise<any[]>;
      
      // 查询相关
      getSubIdsByParentId: (parentId: string, spaceId?: string) => Promise<string[]>;
      getParentIdsBySubId: (subId: string, spaceId?: string) => Promise<string[]>;
      
      // 删除相关
      deleteRelation: (parentId: string, subId: string) => Promise<boolean>;
      batchDeleteRelations: (batchData: BatchDeleteCardRelationDto) => Promise<boolean>;
    };
    
    // 卡片事件监听器
    cardEvents: {
      onLimitReached: (callback: (data: CardLimitData) => void) => () => void;
    };
  }
} 