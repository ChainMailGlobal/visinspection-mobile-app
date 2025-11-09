import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * PlanStorageService - Store and retrieve building plans and their analysis
 */

const PLANS_STORAGE_KEY = 'vis_building_plans';
const CURRENT_PLAN_KEY = 'vis_current_plan';

class PlanStorageService {
  /**
   * Save a scanned/uploaded plan with its analysis
   */
  async savePlan(plan) {
    try {
      const plans = await this.getAllPlans();
      const newPlan = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...plan,
      };

      plans.push(newPlan);
      await AsyncStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
      await this.setCurrentPlan(newPlan.id);

      return newPlan;
    } catch (error) {
      console.error('Error saving plan:', error);
      throw error;
    }
  }

  /**
   * Get all stored plans
   */
  async getAllPlans() {
    try {
      const plansJson = await AsyncStorage.getItem(PLANS_STORAGE_KEY);
      return plansJson ? JSON.parse(plansJson) : [];
    } catch (error) {
      console.error('Error getting plans:', error);
      return [];
    }
  }

  /**
   * Get a specific plan by ID
   */
  async getPlan(id) {
    try {
      const plans = await this.getAllPlans();
      return plans.find(p => p.id === id);
    } catch (error) {
      console.error('Error getting plan:', error);
      return null;
    }
  }

  /**
   * Set the current active plan (for overlay in inspection)
   */
  async setCurrentPlan(id) {
    try {
      await AsyncStorage.setItem(CURRENT_PLAN_KEY, id);
    } catch (error) {
      console.error('Error setting current plan:', error);
    }
  }

  /**
   * Get the current active plan
   */
  async getCurrentPlan() {
    try {
      const currentId = await AsyncStorage.getItem(CURRENT_PLAN_KEY);
      if (!currentId) return null;

      return await this.getPlan(currentId);
    } catch (error) {
      console.error('Error getting current plan:', error);
      return null;
    }
  }

  /**
   * Delete a plan
   */
  async deletePlan(id) {
    try {
      const plans = await this.getAllPlans();
      const filtered = plans.filter(p => p.id !== id);
      await AsyncStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(filtered));

      // Clear current plan if it was deleted
      const currentId = await AsyncStorage.getItem(CURRENT_PLAN_KEY);
      if (currentId === id) {
        await AsyncStorage.removeItem(CURRENT_PLAN_KEY);
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      throw error;
    }
  }

  /**
   * Clear all plans
   */
  async clearAllPlans() {
    try {
      await AsyncStorage.removeItem(PLANS_STORAGE_KEY);
      await AsyncStorage.removeItem(CURRENT_PLAN_KEY);
    } catch (error) {
      console.error('Error clearing plans:', error);
      throw error;
    }
  }
}

export default new PlanStorageService();
