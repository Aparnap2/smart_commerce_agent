import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import { createCommerceAgent } from './lib/agents/commerce-agent';
import { HumanMessage } from '@langchain/core/messages';

async function verifyCore() {
    console.log('--- STARTING CORE VERIFICATION ---');

    // 1. Verify Database Connection
    console.log('\n1. Verifying Database Connection (Prisma)...');
    console.log(`Using DATABASE_URL: ${process.env.DATABASE_URL}`);
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL
            }
        }
    });
    try {
        const productCount = await prisma.product.count();
        console.log(`✅ Success: Database connected. Found ${productCount} products.`);
    } catch (err) {
        console.error(`❌ Failed: Database error:`, err);
        process.exit(1);
    }

    // 2. Verify LangGraph Agent
    console.log('\n2. Verifying LangGraph Agent & Tool Calling...');
    try {
        const agent = createCommerceAgent();
        console.log('✅ Success: Commerce Agent initialized.');

        console.log('Sending message to agent: "Do you have any computers or laptops?"...');
        const response = await agent.invoke([new HumanMessage("Do you have any computers or laptops?")]);

        if (response) {
            console.log('✅ Agent responded successfully.');

            if (response.tool_calls && response.tool_calls.length > 0) {
                console.log(`✅ Agent correctly decided to use tool: ${response.tool_calls[0].name}`);
                console.log(`Tool parameters:`, response.tool_calls[0].args);
            } else {
                console.log(`Agent response content: ${response.content}`);
            }
        } else {
            console.log('❌ Agent provided empty response.');
        }
    } catch (err) {
        console.error(`❌ Failed: Agent error:`, err);
    } finally {
        await prisma.$disconnect();
    }
}

verifyCore().catch(console.error);
