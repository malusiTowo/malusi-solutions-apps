/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type CreateHabitInput = {
  color: HabitColor;
  dailyGoal?: string | null | undefined;
  name: string;
  reminderAt?: string | null | undefined;
  repeatDays: Array<number>;
};

export type HabitColor =
  | 'blue'
  | 'lime'
  | 'orange'
  | 'pink'
  | 'purple';

export type HealthQueryVariables = Exact<{ [key: string]: never; }>;


export type HealthQuery = { health: { ok: boolean, service: string } };

export type CreateHabitMutationVariables = Exact<{
  input: CreateHabitInput;
}>;


export type CreateHabitMutation = { createHabit: { id: string, name: string, color: HabitColor, repeatDays: Array<number>, reminderAt: string | null, dailyGoal: string | null, streak: number, createdAt: string } };


export const HealthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ok"}},{"kind":"Field","name":{"kind":"Name","value":"service"}}]}}]}}]} as unknown as DocumentNode<HealthQuery, HealthQueryVariables>;
export const CreateHabitDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateHabit"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateHabitInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createHabit"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"repeatDays"}},{"kind":"Field","name":{"kind":"Name","value":"reminderAt"}},{"kind":"Field","name":{"kind":"Name","value":"dailyGoal"}},{"kind":"Field","name":{"kind":"Name","value":"streak"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<CreateHabitMutation, CreateHabitMutationVariables>;