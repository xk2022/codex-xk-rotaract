import {createContext,useContext,useRef,useState,type ReactNode} from 'react';
import {useBusinessDemo} from '../phase3/businessStore';
import {useCommunityDemo} from '../phase2/store';
import {publicClubs,publicProjection} from '../phase2/model';
import {applyFavoriteAction,projectFavorites,type Favorite,type FavoriteAction,type FavoriteContext} from './favoriteModel';
function useFavoriteState(){const business=useBusinessDemo();const community=useCommunityDemo();const [favorites,setFavorites]=useState<Favorite[]>([]);const latest=useRef(favorites);const [memberId,setMemberId]=useState('');const ctx:FavoriteContext={memberIds:business.members.map(m=>m.id),businesses:business.publicBusinesses.map(c=>({id:c.id,name:c.name})),clubs:publicClubs(community.clubs).map(c=>({id:c.id,name:c.name})),events:publicProjection(community.events,community.clubs).map(e=>({id:e.id,title:e.title,status:e.status})),asOf:business.asOf};function commit(next:Favorite[]){latest.current=next;setFavorites(next)}function dispatch(action:FavoriteAction){const result=applyFavoriteAction(latest.current,memberId,action,ctx);if(result.ok)commit(result.favorites);return result}return {memberId,setMemberId,members:business.members,items:projectFavorites(favorites,memberId,ctx),dispatch,reset:()=>{commit([]);setMemberId('')}};}
const Context=createContext<ReturnType<typeof useFavoriteState>|null>(null);
export function FavoriteProvider({children}:{children:ReactNode}){const state=useFavoriteState();return <Context.Provider value={state}>{children}</Context.Provider>}
export function useFavoriteDemo(){const context=useContext(Context);if(!context)throw new Error('FavoriteProvider required');return context}
