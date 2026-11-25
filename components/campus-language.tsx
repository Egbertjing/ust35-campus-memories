"use client";
import {createContext,useContext,useEffect} from 'react';
import {translateCampusText,type CampusLanguage} from '@/lib/campus-language';
const contextValue={language:'en' as CampusLanguage,setLanguage:(_language:CampusLanguage)=>{},t:(text:string)=>translateCampusText(text,'en')};
const LanguageContext=createContext(contextValue);
export function CampusLanguageProvider({children}:{children:React.ReactNode}){useEffect(()=>{document.documentElement.lang='en';document.title='UST35 · Campus Memories';try{localStorage.setItem('hkust-campus-language','en');}catch{}},[]);return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;}
export function useCampusLanguage(){return useContext(LanguageContext);}
